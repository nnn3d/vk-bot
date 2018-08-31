'use strict';

const CoreModuleEventController = require('../../classes/base/CoreModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const express        = require('express');
const { URL } = require('url');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = class Web extends CoreModuleEventController {

    /**
     * @typedef {SpecificationCommand_Web} Specification_Web
     * @property {{name: String, options: Object}} icon
     */

    /**
     *
     * @typedef {Object} SpecificationCommand_Web
     * @property {('info'|'action')} [type]
     * @property {String} [title]
     * @property {String} [description]
     * @property {SpecificationCommand_WebChange|function(props:Object<String,String|Number>|Null,chat:Chat,message:Message,command:SpecificationCommand): SpecificationCommand_WebChange} [change]
     * @property {SpecificationCommand_WebChange|function(props:Object<String,String|Number>|Null,chat:Chat,message:Message,command:SpecificationCommand): SpecificationCommand_WebChange} [hidden]
     * @property {{name: String, ?options: Object}} [icon]
     * @property {String} [submitText]
     * @property {((function(props:Object<String,String|Number>|Null,chat:Chat,message:Message,command:SpecificationCommand): Object<String,SpecificationCommand_WebFilter>|Promise<Object<String, SpecificationCommand_WebFilter>>)|Object<String, SpecificationCommand_WebFilter>)} [filter]
     * @property {((function(props:Object<String,String|Number>,chat:Chat,message:Message,command:SpecificationCommand): String|Promise<*>)|String)} output
     * @property {Number} [reload] if set - reload card every set ms
     * @property {Boolean} [disableReload]
     */

    /**
     *
     * @typedef {Object} SpecificationCommand_WebChange
     * @property {String|Array<String>} [module]
     * @property {String|Array<String>} [command]
     */

    /**
     *
     * @typedef {Object} SpecificationCommand_WebFilter
     * @property {'radio'|'checkbox'|'select'|'multi'|'combo'|'text'|'textarea'} type
     * @property {Array<SpecificationCommand_WebFilterInput|String>} data
     * @property {Object} [options]
     * @property {Boolean} [clear]
     */

    /**
     *
     * @typedef {Object} SpecificationCommand_WebFilterInput
     * @property {String|Number} value
     * @property {String|Number} label
     * @property {Boolean} [default]
     * @property {Boolean} [select]
     */

    constructor({
        port = 80,
        appId,
        appSecret,
    } = {}) {
        super();
        if (!appId || !appSecret) throw new Error(`Web module needs 'appId' and 'appSecret' to work`);
        this.app = express();
        this.appId = appId;
        this.appSecret = appSecret;
        this.port = port;
        // this.bundle = fs.readFileSync(require.resolve('./bundle.js'), 'utf8');
    }

    /**
     *
     * @returns {Specification}
     */
    moduleSpecification() {
        return {};
    }

    /**
     *
     * @param {Number} userId
     * @return {Promise.<Array<Chat>>}
     * @private
     */
    _getChatList(userId) {
        // return this._getChat(userId).then(chat => {
            let chatList = Object.keys(this.bot.chats)
                .map(id => this.bot.chats[id])
                .filter(chat => chat.users.includes(userId) || userId === this.bot.selfId);
            return this.bot.ctrlEmit((userId, chatList) => {
                return chatList;
            }, 'Web.getChatList', userId, chatList);
        // });
    }

    /**
     *
     * @param {Number} chatId
     * @return {Promise<Chat>}
     * @private
     */
    _getChat(chatId) {
        if (!this.bot.chats[chatId])
            return this.bot.createChat(chatId);
        return Promise.resolve(this.bot.chats[chatId]);
    }

    /**
     *
     * @param {Array<Specification>} moduleList
     * @param {String} moduleName
     * @return {Specification|undefined}
     * @private
     */
    _getModule(moduleList, moduleName) {
        return moduleList
            .filter(module => module.name === moduleName)[0];
    }

    /**
     *
     * @param {Specification} module
     * @param {String} commandName
     * @return {SpecificationCommand|undefined}
     * @private
     */
    _getCommand(module, commandName) {
        return module.commands
            .filter(command => command.name === commandName)[0];
    }

    /**
     *
     * @param {Object} props
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     * @returns {Promise<SpecificationCommand>}
     * @private
     */
    _getCommandInfo(props, chat, message, command) {
        let result = Promise.resolve();
        Object.keys(command.web).map(name => {
            if (name === 'output') return;
            let web = command.web;
            if (command.web[name] instanceof Function)
                command.web[name] = command.web[name](props, chat, message, command);
            if (command.web[name] instanceof Promise)
                result = result.then(() => command.web[name].then(info => {
                    command.web[name] = info;
                })).catch(error => {
                    console.error(error);
                    command.web[name] = '';
                });
        });
        return result.then(() => command);
    }

    _setWebInfoToCommand(command, module) {
        command = Object.assign({}, command);
        command.web = Object.assign({}, command.web);
        command.web.moduleName = module.specification.name;
        command.web.filter = command.web.filter || {};
        if (!command.web.icon && module.specification.web && module.specification.web.icon)
            command.web.icon = module.specification.web.icon;
        return command;
    }

    /**
     *
     * @param {Number} chatId
     * @param {Number} userId
     * @param {Boolean} [filter]
     * @returns {Promise<Array<Specification>>}
     * @private
     */
    _getCommandList(chatId, userId, filter = true) {
        let message = new this.Message({
            peer: chatId,
            user: userId,
            id: 1,
        });
        return this._getChat(chatId).then(chat => {
            let commandList = [];
            message.from = chat.type;
            chat.modules
                .map(module => {
                    let commands = module.specification.commands
                        .concat(module.specification.webCommands || [])
                        .filter(command => command.web && this.validateCommand(chat, message, command.check, false))
                        .map(command => this._setWebInfoToCommand(command, module));
                    if (commands.length)
                        commandList.push(Object.assign({}, module.specification, { commands }));
                });
            return this.bot.ctrlEmit((chat, message, commandList) => {
                let promises = [];
                commandList.map(moduleSpec => {
                    moduleSpec.commands.map(command => {
                        if (filter) promises.push(this._getCommandInfo(null, chat, message, command));
                        return command;
                    })
                });
                return promiseFactory.allAsync(promises)
                    .then(() => {
                        commandList.map(moduleSpec => (
                            moduleSpec.commands = moduleSpec.commands.filter(command => command.web.filter)
                        ));
                        commandList.sort(({name: a}, {name: b}) => a > b ? 1 : (a < b ? -1 : 0));
                        return commandList;
                    });
            }, 'Web.getCommandList', chat, message, commandList);
        })
    }

    /**
     *
     * @param {Number} chatId
     * @param {Number} userId
     * @param {String} commandName
     * @param {String} moduleName
     * @param {Object} props
     * @param {Boolean} onlyCommand
     * @return {Promise.<*>}
     * @private
     */
    _getCommandResult(chatId, userId, commandName, moduleName, props, onlyCommand = false) {
        return this._getChat(chatId).then(chat => {
            if (!chat.users.includes(userId) && userId !== this.bot.selfId) return '';
            let message = new this.Message({
                peer: chatId,
                user: userId,
                id: 1,
            });
            return this._getCommandList(chatId, userId, false).then(commandList => {
                message.from = chat.type;
                let module = this._getModule(commandList, moduleName);
                if (!module) {
                    console.error(`cannot find command module '${moduleName}' (chat ${chatId}, user ${userId})`);
                    return '';
                }
                let command = module && this._getCommand(module, commandName);
                let result = Promise.resolve();
                if (!command) {
                    console.error(require('util').inspect(module, false, null))
                    console.error(`cannot find command '${commandName}' in module '${moduleName}' (chat ${chatId}, user ${userId})`);
                    return '';
                }
                if (!onlyCommand) {
                    let output = command.web.output instanceof Function
                        ? command.web.output(props, chat, message, command)
                        : command.web.output;
                    if (output instanceof Promise) {
                        result = result.then(() => output);
                    } else {
                        message.initialText = message.text = output && output.toString() || '';
                        if (command.execute) result = result.then(() => command.execute(chat, message, command));
                        else result = result.then(() => module.object[command.name](chat, message, command));
                        result = result.then(() => message.getResult());
                    }
                }
                result = result.then(result => {
                    return this._getCommandInfo(props, chat, message, command).then(() => result);
                });
                result.then(() => {
                    if (command.web.type === 'action' && !onlyCommand) {
                        console.log('web user', message.user, 'in chat', chat.id, 'run command', command.name, 'module', moduleName);
                    }
                })
                if (onlyCommand) return result.then(() => ({command}));
                return result.then(result => ({ result, command }));
            })
        })
    }

    _init(bot) {
        return super._init(bot).then(() => {
            let cookieName = `vkbot${bot.selfId}`;
            this.app = this.bot.app;
            this.app.use((req, res, next) => {
                if (req.cookies[cookieName]) {
                    let cookie = cookieParser.signedCookie(req.cookies[cookieName], this.appSecret);
                    let cookieInfo;
                    try {
                        cookieInfo = JSON.parse(cookie);
                    } catch (e) {
                        console.error(e);
                    }

                    if (cookieInfo && cookieInfo.userId && cookieInfo.hash
                        && this._validateAuth(cookieInfo.userId, cookieInfo.hash)) {
                        req.userId = +cookieInfo.userId;
                    }
                }
                if (!req.userId && req.headers.referer) {
                    const url = new URL(req.headers.referer);
                    if (url.searchParams) {
                        let userId = url.searchParams.get('viewer_id');
                        let hash = url.searchParams.get('auth_key');
                        if (userId && hash && this._validateAuth(userId, hash)) {
                            req.userId = +userId;
                        }
                    }
                }
                req.checkUser = () => {
                    if (!req.userId) {
                        res.end('Вы не авторизованы!');
                    }
                    return !!req.userId;
                };
                res.error = (text = 'bad request') => {
                    res.status(403);
                    res.send({ error: text });
                };
                next();
            });
            this.app.get('/', (req, res) => {
                let fromVk = !!req.query.viewer_id;
                res.end(this._render(fromVk));
            });
            this.app.post('/', (req, res) => {
                res.redirect('/');
            });
            this.app.get('/web/bundle.js', (req, res) => {
                res.sendFile(path.join(__dirname, 'bundle.js'));
            });
            this.app.post('/web/auth-check', (req, res) => {
                res.send(!!req.userId);
            });
            this.app.post('/web/auth', (req, res) => {
                if (!req.body) return res.end(false);
                let userId = req.body.uid;
                let hash = req.body.hash;
                if (this._validateAuth(userId, hash)) {
                    let userInfo = {
                        userId,
                        hash,
                        name: req.body.first_name || userId,
                        secondName: req.body.last_name || '',
                    };
                    res.cookie(cookieName, JSON.stringify(userInfo));
                    res.send(true);
                } else {
                    res.send(false);
                }
            });
            this.app.post('/web/chats', (req, res) => {
                if (req.checkUser())
                    this._getChatList(req.userId).then(chatList => {
                        res.send(chatList.map(chat => ({
                            id: chat.id,
                            title: chat.title,
                        })))
                    })
                        .catch(error => {
                            console.log(error);
                            res.error();
                        });
            });
            this.app.post('/web/commands', (req, res) => {
                if (req.checkUser() && !isNaN(req.body.chatId))
                    this._getCommandList(req.body.chatId, req.userId)
                        .then(commandList => {
                            console.log('web: user', req.userId, 'load page chat', req.body.chatId);
                            let commands = commandList.reduce((prev, cur) => {
                                return prev.concat(cur.commands);
                            }, []);
                            res.send(commands);
                        })
                        .catch(error => {
                            console.log(error);
                            res.error();
                        });
                else res.error();
            });
            this.app.post('/web/result', (req, res) => {
                if (req.checkUser() && req.body.chatId && req.body.commandName
                    && req.body.moduleName && req.body.props)
                    this._getCommandResult(req.body.chatId, req.userId, req.body.commandName,
                        req.body.moduleName, req.body.props, req.body.onlyCommand)
                        .then(result => result && res.send(result) || res.error())
                        .catch(error => res.error());
                else res.error();
            });

            this.Message = class extends bot.Message {
                constructor(...args) {
                    super(...args);
                    this.result = [];
                    this.sended = new Promise(resolve => {
                        this.sendedResolve = resolve;
                    });
                }

                /**
                 * @return {Promise<String>}
                 */
                getResult(force = false) {
                    setTimeout(this.sendedResolve, 1e4);
                    return this.sended.then(() => this.result.join('<br>'));
                }

                send() {
                    this.sendedResolve();
                    let text = this.getText();
                    text = text.replace(/\[[^|]+\|([^\]]+)[\]]/g, '<b>$1</b>');
                    text = text.replace(/\n/g, '<br>');
                    this.result.push(text);
                    return Promise.resolve(0);
                }

                sendPhoto(source) {
                    this.sendedResolve();
                    let url = source && source.value;
                    if (!url) return Promise.reject();
                    let image = `<img src="${url}" class="img-fluid"/>`;
                    this.result.push(image);
                    return Promise.resolve();
                }
            };
        })
    }

    /**
     *
     * @param {{expire, mid, secret, sid, sig}} data
     * @return {boolean}
     * @private
     */
    _validateUser(data) {
        if (!data.expire || !data.mid || !data.secret || !data.sid || !data.sig) return false;
        let md5 = crypto.createHash('md5');
        md5.update(`expire=${data.expire}mid=${data.mid}secret=${data.secret}sid=${data.sid}${this.appSecret}`);
        let result = md5.digest('hex');
        return result === data.sig;
    }

    _validateAuth(userId, hash) {
        return this._getHash(userId) === hash || this._getHash(userId, '_') === hash;
    }

    _getHash(userId, space = '') {
        return crypto.createHash('md5')
            .update('' + this.appId + space + userId + space + this.appSecret)
            .digest('hex');
    }

    _render(fromVk) {
        return `
    <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Torchmet Панель бота</title>
            <script type="text/javascript">
                var globalAppId = ${this.appId};
            </script>
            <!--<script src="https://vk.com/js/api/xd_connection.js?2"  type="text/javascript"></script>-->
            ${fromVk 
                ? '<script src="https://vk.com/js/api/xd_connection.js?2"  type="text/javascript"></script>' 
                : '<script type="text/javascript" src="//vk.com/js/api/openapi.js?170"></script>'
            }
      </head>
      <body>
        <script type="application/javascript" src="/web/bundle.js"></script>
        <!-- Yandex.Metrika counter -->
        <script type="text/javascript" >
            (function (d, w, c) {
                (w[c] = w[c] || []).push(function() {
                    try {
                        w.yaCounter46441353 = new Ya.Metrika({
                            id:46441353,
                            clickmap:true,
                            trackLinks:true,
                            accurateTrackBounce:true,
                            webvisor:true
                        });
                    } catch(e) { }
                });
        
                var n = d.getElementsByTagName("script")[0],
                    s = d.createElement("script"),
                    f = function () { n.parentNode.insertBefore(s, n); };
                s.type = "text/javascript";
                s.async = true;
                s.src = "https://mc.yandex.ru/metrika/watch.js";
        
                if (w.opera == "[object Opera]") {
                    d.addEventListener("DOMContentLoaded", f, false);
                } else { f(); }
            })(document, window, "yandex_metrika_callbacks");
        </script>
        <noscript><div><img src="https://mc.yandex.ru/watch/46441353" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
        <!-- /Yandex.Metrika counter -->
      </body>
    </html>
  `;
    }
};
