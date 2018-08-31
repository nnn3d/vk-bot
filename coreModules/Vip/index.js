'use strict';

const CoreModuleEventController = require('../../classes/base/CoreModuleEventController');
const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const ChatVipStatus = require('./ChatVipStatus');
const ChatCommandUsage = require('./ChatCommandUsage');
const YandexMoneyInfo = require('./YandexMoneyInfo');
const yandexMoney = require("yandex-money-sdk");

const express        = require('express');
const { URL } = require('url');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const xml = require('xml');
const crypto = require('crypto');
const simplePay = require('./simplePay');
const SimplePayInfo = require('./SimplePayInfo');

class Vip extends CoreModuleEventController {

    /**
     * @typedef {Object} Specification_Vip
     * @property {Boolean} [paid] if true needs vip for use module
     * @property {Boolean} [free] if true - don't init in vip chats
     */

    /**
     * @typedef {Object} SpecificationCommand_Vip
     * @property {Boolean} [paid] needs vip for use this command
     * @property {Number|{ ?chat: Number, ?dm: Number, ?group: Number }} [usages] how many runs on day by dialog
     *
     */


    /**
     *
     * @return {Specification}
     */
    moduleSpecification() {
        return {
            commandList: {
                name: 'Вип',
                description: 'Показывает информацию и управляет вип доступом',
                middleware: this._commandListMiddleware,
            },
            web: {
                icon: {
                    name: 'FaStar',
                    options: {
                        color: 'gold',
                    }
                },
            },
            commands: [
                {
                    name: 'vipInfo',
                    check: {
                        args: 'вип инфо',
                    },
                    commandList: {
                        name: 'вип инфо',
                        description: 'показывает информацию о вип статусе и о том, как его получить',
                    },
                    messageTemplate: {
                        title: `вип статус предназначен для чатов и позволяет использовать вип разделы, снимает все ограничения, а также открывает всем участникам чата доступ в веб панель (torchmet.ru), подробнее о всех функциях тут - https://vk.com/page-155455368_53607863`,
                        body: `стоимость вип статуса на данный момент - ${this.monthCost} р. в месяц для каждого диалога
ссылки для перевода и получения вип статуса в этом чате:
на месяц - torchmet.ru/vip/pay/#{0}/#{1}
на неделю - torchmet.ru/vip/pay/#{2}/#{3}
после перевода дни вип статуса автоматически добавятся в этот чат
(указывать дополнительную информацию о себе во время перевода не обязательно)
если ничего не понял или есть другие вопросы - писать [id#{4}|администратору]`,
                        bodyDm: `для более подробной информации, используйте команду 'вип инфо' в чате`,
                        bodyFail: `информация о получении вип статуса обновляется, повторите попытку позже`,
                        end: `вип разделы команд:\n#{0}`,
                    }
                },
                {
                    name: 'vipNumber',
                    check: {
                        args: 'вип номер',
                        type: 'chat',
                    },
                    commandList: {
                        name: 'вип номер',
                        description: 'показывает номер вашего чата, используемый для продления',
                    },
                    execute: (chat, message) => message.setTitle(chat.id).send(),
                },
                {
                    name: 'vipStatus',
                    check: {
                        args: 'вип статус',
                        type: 'chat',
                    },
                    commandList: {
                        name: 'вип статус',
                        description: 'показывает вип статус и срок действия',
                    },
                    messageTemplate: {
                        fail: 'у вас нет вип статуса',
                        title: 'у вас есть вип статус (истекает через #{0} дн.)',
                    },
                    web: {
                        output: 'вип статус',
                    },
                },
                {
                    name: 'prolongVip',
                    check: {
                        args: ['продлить', 'вип', /\d+/i, /\d+/i],
                        userId: this.admins,
                    },
                    commandList: {
                        name: 'продлить вип',
                        usage: 'продлить вип {id чата} {количество дней}',
                        description: 'продливает вип для чата',
                    },
                    messageTemplate: {
                        title: `вип статус чата #{0} обновлен (заканчивается через #{1} дн.)`
                    },
                    web: {
                        type: 'action',
                        submitText: 'продлить вип',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'vipStatus',
                                'showVip',
                            ],
                        },
                        filter: {
                            chatId: {
                                type: 'text',
                                options: {
                                    placeholder: 'номер чата',
                                },
                            },
                            days: {
                                type: 'text',
                                options: {
                                    placeholder: 'количество дней',
                                },
                            },
                        },
                        output: props => `продлить вип ${props.chatId} ${props.days}`,
                    }
                },
                {
                    name: 'deleteVip',
                    check: {
                        args: ['удалить', 'вип', /\d+/i],
                        userId: this.admins,
                    },
                    commandList: {
                        name: 'удалить вип',
                        usage: 'удалить вип {id чата}',
                        description: 'удаляет вип для чата',
                    },
                    messageTemplate: {
                        title: `вип статус чата #{0} удален`
                    },
                    web: {
                        type: 'action',
                        submitText: 'удалить вип',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'vipStatus',
                                'showVip',
                            ],
                        },
                        filter: {
                            chatId: {
                                type: 'text',
                                options: {
                                    placeholder: 'номер чата',
                                },
                            },
                        },
                        output: props => `удалить вип ${props.chatId}`,
                    }
                },
                {
                    name: 'checkVip',
                    check: {
                        args: 'обновить вип',
                        userId: this.admins,
                    },
                    commandList: {
                        name: 'обновить вип',
                        description: 'проверяет денежные зачисления и обновляет вип статусы',
                    },
                    messageTemplate: {
                        title: 'вип статус чатов обновлен',
                    },
                },
                {
                    name: 'showVip',
                    check: {
                        args: 'покажи вип',
                        userId: this.admins,
                    },
                    commandList: {
                        name: 'покажи вип',
                        description: 'показывает вип чаты и срок действия',
                    },
                    messageTemplate: {
                        title: 'вип чаты:',
                        body: '#{0} (#{1} дн.)',
                        fail: 'нет чатов с вип статусом',
                    },
                    web: {
                        output: `покажи вип`,
                    }
                },
            ],
            webCommands: [
                {
                    name: 'payVip',
                    check: {},
                    web: {
                        title: 'продлить вип статус',
                        type: (props) => (props && parseInt(props.amount) > 0) ? 'info' : 'action',
                        submitText: (props) => (props && parseInt(props.amount) > 0) ? 'обновить' : 'получить ссылку',
                        filter: (props, chat) => {
                            if (props && parseInt(props.amount) > 0) {
                                return {};
                            } else return {
                                info: {
                                    type: 'textarea',
                                    options: {
                                        readonly: 'readonly',
                                        rows: '10',
                                    },
                                    data: {
                                        value: `вип статус предназначен для чатов и позволяет использовать вип разделы (модули), а также снимает все ограничения, а также открывает всем участникам чата доступ в веб панель (torchmet.ru), подробнее о всех функциях тут - https://vk.com/page-155455368_53607863\nстоимость вип статуса на данный момент - ${this.monthCost} р. в месяц для каждого диалога`,
                                        select: true,
                                    }
                                },
                                amount: {
                                    type: 'text',
                                    options: {
                                        placeholder: 'сумма для продления, р.',
                                        pattern: '[1-9][0-9]*',
                                        title: 'число больше 0',
                                    }
                                },
                            }
                        },
                        output: (props, chat) => {
                            let amount = parseInt(props.amount);
                            if (amount > 0) {
                                let days = Math.ceil(this._amountToTime(amount) / (24 * 36e5));
                                return Promise.resolve(`
                                    <a href="/vip/pay/${chat.id}/${amount}" target="_blank">
                                        продлить вип статус чата "${chat.title}" (#${chat.id}) на сумму ${amount} руб. (~${days} дн.)
                                    </a>
                                `)
                            } else if (props.amount) {
                                return Promise.resolve('неверная сумма');
                            } else {
                                return Promise.resolve('');
                            }
                        }
                    }
                }
            ]
        };
    }

    constructor({
        token,
        admins = [],
        freeChats = [],
        monthCost = 100,
        checkInterval = 6e5,
        antiCaptcha = {},
        port = 80,
        appId,
        appSecret,
        payOutletId,
        paySecretKey,
        payResultSecretKey
    } = {}) {
        super();
        this.admins = Array.isArray(admins) && admins || [];
        this.freeChats = freeChats;
        this.token = token;
        this.usages = {};
        this.monthCost = monthCost;
        this.checkInterval = checkInterval;
        this.bans = new Set();
        this.bansInterval = setInterval(() => this.bans.clear(), 1e6);
        this.antiCaptcha = antiCaptcha;
        this.specification = this.moduleSpecification();

        if (!appId || !appSecret || !payOutletId || !paySecretKey) {
            console.error(`Pay module needs 'appId' and 'appSecret' and 'payOutletId' and 'paySecretKey' and 'payResultSecretKey' to normal work`);
        }
        this.appId = appId;
        this.appSecret = appSecret;
        this.payOutletId = payOutletId;
        this.paySecretKey = paySecretKey;
        this.payResultSecretKey = payResultSecretKey;
        this.port = port;
    }

    /**
     *
     * @return {Promise}
     * @private
     */
    _yandexInit() {
        this.yandexMoney =  new yandexMoney.Wallet(this.token);
        return promiseFactory.callbackToPromise(this.yandexMoney.accountInfo.bind(this.yandexMoney))
            .then(([err, data]) => {
                if (err) {
                    console.error(err);
                    throw err;
                }
                this.walletId = data.account;
                this.checkYMInterval = setInterval(() => this._checkYM(), this.checkInterval);
                this._checkYM();
                this.specification = this.moduleSpecification();
            });
    }

    /**
     *
     * @return {Promise}
     * @private
     */
    _yandexFinal() {
        clearInterval(this.checkYMInterval);
    }

    /**
     *
     * @param {Bot} bot
     * @return {Promise.<*>}
     * @private
     */
    _init(bot) {
        this.admins.push(bot.selfId);
        // process.on('message', packet => {
        //     if (packet.topic === 'vipAddToChat') {
        //         this._addVip(packet.data, true);
        //     }
        // });
        return super._init(bot).then(() => promiseFactory.allAsync([
            this.bot.Chat.global.pre(this.bot.Chat.eventNames.addModule, this._preAddModule, this),
            ModuleEventController.global.pre(this.eventNames.runCommand, this._preRunCommand, this),
            CoreModuleEventController.global.pre(this.eventNames.runCommand, this._preRunCommand, this),
            ModuleEventController.global.on(this.eventNames.runCommand, this._onRunCommand, this),
            CoreModuleEventController.global.on(this.eventNames.runCommand, this._onRunCommand, this),
            // this.bot.Chat.global.pre(this.bot.Chat.eventNames.init, (chat) => {
            //     return this._isVipChat(chat.id).then(vip => {
            //         if (!vip) throw 'not vip chat';
            //     })
            // }, this),
            this.bot.middlewareOn('Web.getChatList', this._webGetChatList, this),
            this.bot.pre('VkRemoveChatUser', this._onRemoveUser, this),
            this.bot.pre('addBotToChat', this._onAddBotToChat, this),
            this.bot.pre('checkBotFriends', this._onCheckBotFriends, this),
            this._yandexInit(),
            () => {
                this.app = this.bot.app;
                this.app.get('/vip/pay/:chatId/:amount', (req, res) => {
                    let { chatId, amount } = req.params;
                    let { uid: userId, hash } = req.query;
                    chatId = +chatId;
                    userId = +userId;
                    amount = +amount;
                    if (isNaN(chatId) || isNaN(amount)) {
                        return res.redirect('/');
                    }
                    if (userId && hash && this._validateAuth(userId, hash)) {
                        let desc = `Продление вип статуса чата №${chatId} (Пользователь №${userId})`;
                        let payId = +`${Date.now()}${parseInt(Math.random()*10)}`;
                        let params = {
                            sp_order_id: payId,
                            sp_outlet_id: this.payOutletId,
                            sp_amount: amount,
                            sp_description: desc,
                            sp_user_name: `Пользователь №${userId}`,
                            sp_user_phone: `89991234567`,
                            sp_user_contact_email: `mail@example.com`,
                        };
                        let url = 'https://api.simplepay.pro/sp/payment';
                        let redirectUrl = simplePay.makePaymentRequest(params, url, this.paySecretKey);
                        new SimplePayInfo({
                            payId, userId, chatId, amount
                        }).save().then(() => res.redirect(redirectUrl));
                    } else {
                        res.end(this._render())
                    }
                });
                this.app.post('/vip/result', (req, res) => {
                    let body = JSON.parse(req.body.sp_json)[0];
                    let fromSig = body.sp_sig;
                    let sig = simplePay.makeSignatureString(
                        Object.assign({}, body),
                        'result',
                        this.payResultSecretKey
                    );
                    if (fromSig === sig && +body.sp_result) {
                        let payId = +body.sp_order_id;
                        let amount = +body.sp_amount;
                        return SimplePayInfo
                            .findOne({payId})
                            .then(doc => {
                                console.log(doc, doc.complete, doc.chatId)
                                if (doc.complete) return;
                                return SimplePayInfo
                                    .findOneAndUpdate({payId}, {complete: true})
                                    .exec()
                                    .then(() => {
                                        return this._prolongVipStatus(doc.chatId, this._amountToTime(amount))
                                    })
                            })
                            .then(() => {
                                return { sp_status: 'ok' };
                            })
                            .catch((error) => {
                                console.error(error);
                                return { sp_status: 'error' };
                            })
                            .then((params = {}) => {
                                res.set('Content-Type', 'text/xml');
                                params.sp_sig = simplePay.makeSignatureString(
                                    params,
                                    'result',
                                    this.payResultSecretKey
                                );
                                let xmlData = Object.keys(params).map(key => ({[key]: params[key]}))
                                res.end(xml({ response: xmlData }));
                            })
                    }
                })
            }
        ]))
    }

    /**
     *
     * @return {Promise.<*>}
     * @private
     */
    _final() {
        return super._final().then(() => promiseFactory.allAsync([
            this.bot.Chat.global.removeListenersPreByHandler(this.bot.Chat.eventNames.addModule, this),
            ModuleEventController.global.removeListenersPreByHandler(this.eventNames.runCommand, this),
            CoreModuleEventController.global.removeListenersPreByHandler(this.eventNames.runCommand, this),
            ModuleEventController.global.removeListenersOnByHandler(this.eventNames.runCommand, this),
            CoreModuleEventController.global.removeListenersOnByHandler(this.eventNames.runCommand, this),
            this.bot.removeMiddlewareOnByHandler('Web.getChatList', this),
            this.bot.removeListenersPreByHandler('VkRemoveChatUser', this),
            this.bot.removeListenersPreByHandler('addBotToChat', this),
            this.bot.removeListenersPreByHandler('checkBotFriends', this),
            this._yandexFinal(),
        ]));
    }

    /**
     *
     * @param {Chat} chat
     * @return {Promise.<*>}
     * @private
     */
    _initChat(chat) {
        if (this.freeChats.includes(chat.id))
            return chat.removeModule(this);
        return super._initChat(chat);
    }

    /**
     *
     * @param {Chat} chat
     * @return {Promise.<*>}
     * @private
     */
    _finalChat(chat) {
        return super._finalChat(chat);
    }

    _validateAuth(userId, hash) {
        return this._getHash(userId) === hash || this._getHash(userId, '_') === hash;
    }

    _getHash(userId, space = '') {
        return crypto.createHash('md5')
            .update('' + this.appId + space + userId + space + this.appSecret)
            .digest('hex');
    }

    _render() {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Torchmet Продление вип статуса</title>
            <script type="text/javascript" src="//vk.com/js/api/openapi.js?170"></script>
            <script type="text/javascript">
                VK.init({apiId: ${this.appId}});
            </script>
            <style>
                body, html {
                    height: 100%;
                }
                .wrapper {
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                #vk_auth {
                    margin: auto;
                }
                .wrapper h3 {
                    margin-bottom: 20px;
                    font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;
                }
            </style>
        </head>
        <body>
        
        <!-- VK Widget -->
        <div class="wrapper">
            <div>
                <h3>Для продолжения необходимо авторизоваться</h3>
                <div id="vk_auth"></div>
            </div>
        </div>
        <script type="text/javascript">
          VK.Widgets.Auth("vk_auth", {"authUrl": document.location.pathname});
        </script>
        </body>
        </html>
        `
    }

    /**
     *
     * @param {Number} chatId
     * @param {Number} time
     * @return {Promise.<ChatVipStatus>}
     * @private
     */
    _prolongVipStatus(chatId, time) {
        return this._isVipChat(chatId)
            .then(vip => {
                time = vip && vip.time ? vip.time + time : Date.now() + time;
                return ChatVipStatus.findOneAndUpdate(
                    { chatId: chatId },
                    { time },
                    {
                        new: true,
                        upsert: true,
                        setDefaultsOnInsert: true,
                    }
                ).exec()
                    .then(doc => {
                        let days = Math.ceil((doc.time - Date.now()) / (24 * 36e5));
                        let promise = new this.bot.Message({ peer: chatId })
                            .setTitle(`статус вип продлен! (истекает через ${days} дн.)`)
                            .send({
                                antiCaptcha: { default: true, selfDirect: true }
                            });
                        if (!vip) {
                            this._addVip(chatId);
                        }
                        return promise.then(() => doc);
                    })
                    .catch(console.error)
            });
    }

    _addVip(chatId, fromMessage = false) {
        // if (!this.bot.clusterMode || fromMessage)
            return this.bot.removeChat(chatId);
        // else this.bot.clusterMode.send({
        //         topic: 'vipAddToChat',
        //         data: chatId,
        //     });
    }

    _amountToTime(amount) {
        return Math.round(31 * 24 * 36e5 * amount / this.monthCost);
    }

    _timeToAmount(time) {
        return Math.round(time * this.monthCost / (31 * 24 * 36e5));
    }

    /**
     *
     * @param {Number} fromRecord
     * @return {Promise}
     * @private
     */
    _loadAndSaveYMOperations(fromRecord = 0) {
        return promiseFactory.callbackToPromise(this.yandexMoney.operationHistory.bind(this.yandexMoney), {
            records: 100,
            details: true,
            from: fromRecord,
            type: 'deposition',
            direction: 'in',
        }).then(([err, data]) => {
            if (err) {
                console.error(err);
                throw err;
            }
            if (!data.operations) return Promise.resolve();
            if (fromRecord) data.operations = data.operations.slice(0, -1);
            if (!data.operations.length) return false;
            let result = Promise.resolve();
            let lastRecord = data.operations[0].datetime || fromRecord;
            for (let operation of data.operations) {
                if (isNaN(+operation.message)) continue;
                let time = this._amountToTime(operation.amount);
                result = result.then(() => this._prolongVipStatus(+operation.message, time))
                    .catch(console.error);
            }
            return result.then(() => {
                return YandexMoneyInfo.findOneAndUpdate(
                    { walletId: this.walletId },
                    { from: lastRecord },
                    { upsert: true }
                ).exec()
            })
        })
    }

    /**
     *
     * @return {Promise}
     * @private
     */
    _checkYM() {
        if (!this.walletId || this.bot.clusterMode && this.bot.clusterMode.instanceNum !== 0) return Promise.resolve(false);
        return YandexMoneyInfo.findOne({ walletId: this.walletId }).exec().then(doc => {
            let fromRecord = doc ? doc.from : 0;
            return this._loadAndSaveYMOperations(fromRecord);
        })
    }

    /**
     *
     * @param {Number} chatId
     * @return {Promise<false|ChatVipStatus>}
     * @private
     */
    _isVipChat(chatId) {
        if (this.freeChats.includes(chatId) || this.bot.admins.includes(chatId)) return Promise.resolve(true);
        return ChatVipStatus.findOne({ chatId }).exec().then(doc => {
            if (!doc) return false;
            return (doc.time > Date.now() && doc);
        })
    }

    /**
     *
     * @param {Specification} specification
     * @param {Chat} chat
     * @private
     */
    _commandListMiddleware(specification, chat) {
        return this._isVipChat(chat.id).then(vip => {
            if (vip) return;
            let addToDesc = (commandList, text, to = 'usage', delimiter = ' ') => {
                if (commandList[to]) commandList[to] += delimiter;
                else commandList[to] = commandList.name || '';
                commandList[to] += text;
            };
            return ChatCommandUsage.find({ chatId: chat.id, module: specification.name }).exec().then(docs => {
                if (specification.vip && specification.vip.paid) {
                    addToDesc(specification.commandList, `*vip*`, 'description');
                }
                for (let command of specification.commands) {
                    if (!command.vip) continue;
                    let maxUsages = command.vip.usages instanceof Object
                        ? command.vip.usages[chat.type] : command.vip.usages;
                    if (command.vip.paid) {
                        addToDesc(command.commandList, `*vip*`);
                    } else if (maxUsages) {
                        let usages = 0;
                        for (let doc of docs) {
                            if (command.name !== doc.command) continue;
                            usages = doc.usages;
                        }
                        addToDesc(command.commandList, `*исп. ${Math.max(maxUsages - usages, 0)}*`);
                    }
                }
            });
        });

    }

    /**
     *
     * @param {ModuleEventController} module
     * @param {Chat} chat
     * @private
     */
    _preAddModule(module, chat) {
        if (!(module.specification.vip && (module.specification.vip.paid || module.specification.vip.free))) return;
        return this._isVipChat(chat.id).then(vip => {
            let free, paid;
            if (module.specification.vip.free) {
                if (typeof module.specification.vip.free === 'string') {
                    free = module.specification.vip.free === chat.type;
                } else free = true;
            }
            if (module.specification.vip.paid) {
                if (typeof module.specification.vip.paid === 'string') {
                    paid = module.specification.vip.paid === chat.type;
                } else paid = true;
            }
            if (!vip && paid || vip && free)
                return chat.removeModule(module).then(() => {
                    let to = paid ? 'vip' : 'free';
                    throw `module '${module.specification.name}' only for ${to} chats (chat ${chat.id})`;
                })
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     * @param {ModuleEventController} module
     */
    _preRunCommand(chat, message, command, module) {
        return this._isVipChat(chat.id).then(vip => {
            if (!command.vip || this.bot.admins.includes(message.user) || vip) {
                if (vip) {
                    command.vip = command.vip || {};
                    command.vip.status = true;
                }
                return;
            }
            if (module.specification.vip && module.specification.vip.paid) {
                return message
                    .setTitle(`данный раздел доступен только для чатов с вип статусом! (подробнее про вип статус в команде '${this.bot.getBotName()} вип инфо')`)
                    .createReply()
                    .send()
                    .then(() => {throw `module '${module.specification.name}' only for vip chats (chat ${chat.id})`})
            }
            if (command.vip.paid) {
                return message
                    .setTitle(`данная команда доступна только для чатов с вип статусом! (подробнее про вип статус в команде '${this.bot.getBotName()} вип инфо')`)
                    .createReply()
                    .send()
                    .then(() => {throw `command '${command.name}' in module '${module.specification.name}' only for vip chats (chat ${chat.id})`})
            }
            if (!command.vip.usages || command.vip.usages instanceof Object && !command.vip.usages[chat.type]) return;
            let info = {
                chatId: chat.id,
                module: module.specification.name,
                command: command.name,
            };
            let updateInfo = () => (
                ChatCommandUsage.findOneAndUpdate(info,
                    { $inc: { usages: 1 } },
                    {
                        new: true,
                        upsert: true,
                        setDefaultsOnInsert: true,
                    })
                    .exec()
                    .catch(console.error)
            );
            command.vip.updateInfo = updateInfo;
            return ChatCommandUsage.findOne(info)
                .exec()
                .catch(err => console.error(err))
                .then(doc => {
                    let maxUsages = command.vip.usages instanceof Object
                        ? command.vip.usages[chat.type] : command.vip.usages;
                    if (doc && doc.usages >= maxUsages) {
                        let result = Promise.resolve();
                        let commandId = `${chat.id}${module.specification.name}${command.name}`;
                        if (!this.bans.has(commandId)) {
                            this.bans.add(commandId);
                            let moduleName = module.specification.commandList && module.specification.commandList.name || module.specification.name;
                            let commandName = command.commandList && command.commandList.name || command.name;
                            result = result.then(() => {
                                return message
                                    .setTitle(`Лимит использований команды ${commandName} (${moduleName}) за день исчерпан (${maxUsages} раз в день)! 
Попробуй завтра или приобрети себе вип статус (команда '${this.bot.getBotName()} вип инфо')`)
                                    .createReply()
                                    .send();
                            });
                        }
                        return result.then(() => {
                            throw `out of day limits on command '${command.name}' in module '${module.specification.name}' (chat ${chat.id})`;
                        })
                    }
                    // return updateInfo();
                })
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     * @param {ModuleEventController} module
     */
    _onRunCommand(chat, message, command, module) {
        if (command.vip && command.vip.updateInfo) return command.vip.updateInfo();
    }

    _webGetChatList([userId, chatList]) {
        return promiseFactory.allAsync(chatList.map(chat => (
            this._isVipChat(chat.id).then(vip => vip && chat)
        ))).then(chats => [userId, chats.filter(chat => chat)]);
    }

    _onRemoveUser(chatId, userId) {
        if (userId !== this.bot.selfId) return;
        return this._isVipChat(chatId).then(vip => { if (vip) throw `chat ${chatId} is vip, cant remove myself` });
    }

    _onAddBotToChat(chat, botId) {
        return this._isVipChat(chat.id).then(vip => {
            let vipBots = this.antiCaptcha.vipBots ? [].concat(this.antiCaptcha.vipBots) : [ botId ];
            if (!vip && vipBots.includes(botId)) throw `don't add VIP bot to not VIP chat (${chat.id})`;
            // else if (vip && !vipBots.includes(botId)) throw `don't add not VIP bot to VIP chat (${chat.id})`;
        })
    }

    _onCheckBotFriends(botId) {
        let vipBots = this.antiCaptcha.vipBots ? [].concat(this.antiCaptcha.vipBots) : [ botId ];
        if (vipBots.includes(botId)) throw `dont need to check friend from bot ${botId}`;
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    vipInfo(chat, message, command) {
        let bodyText = command.messageTemplate.body;
        if (chat.type === 'dm') bodyText = command.messageTemplate.bodyDm;
        let modulesText = '';
        for (let module of this.bot.modules) {
            let specification = module.specification;
            if (specification.vip && specification.vip.paid && !(specification.type && specification.type !== chat.type)) {
                let tmpText = `➤ раздел `;
                if (specification.commandList && specification.commandList.name)
                    tmpText += `${specification.commandList.name.toUpperCase()}:\n`;
                else tmpText += `${specification.name.toUpperCase()}:\n`;
                if (specification.commandList && specification.commandList.description)
                    tmpText += `${specification.commandList.description}\n`;
                modulesText += tmpText;
            }
        }
        message.setTitle(command.messageTemplate.title)
            .setBodyTemplate(
                bodyText,
                chat.id,
                this.monthCost,
                chat.id,
                Math.floor(this.monthCost * 7 / 31),
                this.admins[0]
            );
        if (modulesText) message.setEndTemplate(command.messageTemplate.end, modulesText);
        return message.send({ chatSpamBan: { link: true } });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    vipStatus(chat, message, command) {
        return this._isVipChat(chat.id).then(vip => {
            if (vip) {
                let days = Math.ceil((vip.time - Date.now()) / (24 * 36e5));
                message.setTitleTemplate(command.messageTemplate.title, days);
            } else {
                message.setTitle(command.messageTemplate.fail);
            }
            return message.send();
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    prolongVip(chat, message, command) {
        let chatId = message.getCommandArgs()[2];
        let days = message.getCommandArgs()[3];
        let time = days * 24 * 36e5;
        return this._prolongVipStatus(chatId, time).then(doc => {
            let days = Math.ceil((doc.time - Date.now()) / (24 * 36e5));
            return message.setTitleTemplate(command.messageTemplate.title, chatId, days).send();
        })
    }


    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    deleteVip(chat, message, command) {
        let chatId = message.getCommandArgs()[2];
        return ChatVipStatus.remove({ chatId }).then(() => {
            this._addVip(chatId);
            return message.setTitleTemplate(command.messageTemplate.title, chatId).send();
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    checkVip(chat, message, command) {
        return this._checkYM().then(() => message.setTitle(command.messageTemplate.title).send());
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showVip(chat, message, command) {
        return ChatVipStatus.find({ time: { $gt: Date.now() } }).exec().then(docs => {
           if (!docs.length) return message.setTitle(command.messageTemplate.fail).send();
           return message.setTitle(command.messageTemplate.title)
               .setBodyTemplate(command.messageTemplate.body, n => docs[n].chatId,
                       n => Math.ceil((docs[n].time - Date.now()) / (24 * 36e5)))
               .setTemplateLength(docs.length)
               .send()
        });
    }
}

module.exports = Vip;
