'use strict';

const CoreModuleEventController = require('../../classes/base/CoreModuleEventController');
const ModuleEventController = require('../../classes/base/ModuleEventController');
const pf = require('../../helpers/promiseFactory');
const request = require('request').defaults({ encoding: null });

module.exports = class AntiCaptcha extends CoreModuleEventController {

    /**
     * @typedef {Object} SpecificationCommand_AntiCaptcha
     * @property {Boolean} [selfDirect]
     *
     */

    constructor({token, onlyAdditional = false} = {}) {
        super();
        this.token = token;
        this.antiCaptcha = require('./anticaptcha')(this.token);
        this.solvePromise = Promise.resolve();
        this.solveNow = false;
        this.captchaRetry = null;
    }

    /**
     *
     * @return {Specification}
     */
    moduleSpecification() {
        return {
            type: 'chat',
        };
    }

    _init(bot) {
        this.addBotPendingCount = 0;
        process.on('message', packet => this._onProcessMessage(packet));
        this.defaultSend = bot.vk.api.messages.send.bind(bot.vk.api);
        bot.vk.api.messages.send = this._sendMessage.bind(this);
        bot.vk.setCaptchaHandler(this.solveCaptcha.bind(this));
        return super._init(bot).then(() => pf.allAsync([CoreModuleEventController, ModuleEventController].map(module => {
            return module.global.middlewarePre(this.eventNames.runCommand, this._middlewarePreRunCommand, this);
        })));
    }

    _final() {
        return super._final().then(() => pf.allAsync([CoreModuleEventController, ModuleEventController].map(module => {
            return module.global.removeMiddlewarePreByHandler(this.eventNames.runCommand, this);
        })))
    }

    _sendMessage(params = {}) {
        if (params.antiCaptcha && params.antiCaptcha.selfDirect) {
            return this.solvePromise.then(() => this.defaultSend(params));
        }
        return Promise.resolve(0)
    }

    _middlewarePreRunCommand([chat, message, command]) {
        if (command.antiCaptcha && command.antiCaptcha.selfDirect) {
            return message.middlewarePre(message.eventNames.sendInit, ([params = {}]) => {
                params.antiCaptcha = params.antiCaptcha || {};
                params.antiCaptcha.selfDirect = true;
            });
        }
    }

    _onProcessMessage(packet) {
        if (!(packet instanceof Object) || !packet.topic) return;
        if (packet.topic === 'antiCaptchaSolve' && this.bot.clusterMode.instanceNum !== 0) {
            console.log(`Get captcha key!`);
            this._afterSolve(packet.data.key);
        }
        if (packet.topic === 'antiCaptchaStartSolve' && this.bot.clusterMode.instanceNum === 0) {
            if (!this.solve)
                this.solveCaptcha(packet.data.src, packet.data.sid, null, packet.data.method, packet.data.params);
        }
    }

    _afterSolve(key = null) {
        this.solve = false;
        let solveResolve = this.solveResolve;
        let captchaRetry = this.captchaRetry;
        this.solveResolve = null;
        this.captchaRetry = null;
        let retryTimes = 0;
        let maxRetryTimes = 4;
        if (captchaRetry instanceof Function) {
            let catchError = error => {
                if (error instanceof Error && error.code === 14) {
                    if (retryTimes++ >= maxRetryTimes) return;
                    setTimeout(() => this.solvePromise.then(() => captchaRetry().catch(catchError)), 5e2)
                }
            };
            captchaRetry(key).catch(catchError);
        }
        if (solveResolve instanceof Function) {
            setTimeout(() =>  solveResolve(), 200);
        }
        clearTimeout(this.retryTimeout);
    }

    solveCaptcha(src, sid, retry = null, method, params) {
        console.log('captcha', method);
        let setRetry = () => new Promise(resolve => {
            setTimeout(() => resolve(this.solvePromise.then(() => {
                if (this.solve) return setRetry();
                retry && retry().catch(error => console.error('other captcha', error));
            })), 1e3);
        });
        if (this.solve) return retry ? setRetry() : null;
        this.solve = Date.now();
        if (this.bot.clusterMode && this.bot.clusterMode.instanceNum !== 0) {
            if (!this.solveResolve) {
                console.log(`Wait solve captcha...`);
                this.captchaRetry = retry;
                this.solvePromise = new Promise(resolve => this.solveResolve = resolve);
                this.retryTimeout = setTimeout(() => this._afterSolve(), 3e4);
                this.bot.clusterMode.send({
                    topic: 'antiCaptchaStartSolve',
                    data: {
                        src,
                        sid,
                        method,
                        params
                    },
                });
            }
            return this.solvePromise;
        }
        let retryKey;
        console.log(`Start solve captcha...`);
        let image;
        let antiCaptcha = this.antiCaptcha;
        this.solvePromise = pf.cbp(request.get.bind(request), src)
            .then(([error, response, body]) => {
                if (!error && response.statusCode === 200) {
                    image = body.toString('base64');
                } else throw error;
            })
            .then(() => pf.dcbp(antiCaptcha.getBalance.bind(antiCaptcha)))
            .then(balance => {
                if (balance <= 0.1) throw new Error('Anti captcha balance is 0');
                return pf.dcbp(antiCaptcha.createImageToTextTask.bind(antiCaptcha), {
                    case: true,
                    body: image,
                });
            })
            .then(taskId => {
                return pf.dcbp(antiCaptcha.getTaskSolution.bind(antiCaptcha), taskId);
            })
            .then((key) => {
                retryKey = key;
                if (retry)
                    return retry(key);
            })
            .then(() => {
                console.log(`Captcha solved!`);
                this._afterSolve();
                if (this.bot.clusterMode && this.bot.clusterMode.instanceNum === 0) {
                    this.bot.clusterMode.send({
                        topic: 'antiCaptchaSolve',
                        data: {
                            key: retryKey,
                        },
                    });
                }
                // return this.bot.setPause(false);
            })
            .catch((error) => {
                console.error(`Captcha error `, error);
                this.solve = false;
                if (this.bot.clusterMode && this.bot.clusterMode.instanceNum === 0) {
                    this.bot.clusterMode.send({
                        topic: 'antiCaptchaSolve',
                        data: {
                            key: retryKey,
                        },
                    });
                }
                if (error instanceof Error && error.code === 14 && retry) {
                    let catchError = error => {
                        if (error instanceof Error && error.code === 14) {
                            setTimeout(() => this.solvePromise.then(() => retry().catch(catchError)), 5e2)
                        }
                    };
                    retry(retryKey).catch(catchError);
                }
            });
        return this.solvePromise;
    }

};
