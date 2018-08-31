'use strict';

const StandardEventController = require('../base/StandardEventController');
const VK = require('../../vk');
const Chat = require('../core/Chat');
const Message = require('../core/Message');
const promiseFactory = require('../../helpers/promiseFactory');
const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
let mongoose = require('mongoose');

class Bot extends StandardEventController {

    /**
     *
     * @param {{token}} vk
     * @param {{name: String|Array<String>, admins: Array}} bot
     * @param {{uri}} bd
     * @param {Array<ModuleEventController>} coreModules
     * @param {Array<ModuleEventController>} modules
     */
    constructor({
        bot,
        vk,
        db,
        additionalTokens = [],
        groupTokens = [],
        coreModules = [],
        modules = [],
        express: {
            port = 80
        } = {},
    }) {
        super();
        this.config = {
            bot,
            vk,
            db,
            additionalTokens,
            groupTokens,
            modules,
            coreModules,
            express: { port }
        };
        /**
         *
         * @type {Object<Number, Chat>}
         */
        this.chats = {};
        this.createChats = {};
        this.name = bot.name;
        this.admins = bot.admins || [];
        this.vk = this.createVk(vk, true);
        this.additionalAccounts = [];
        additionalTokens.map(token => {
            let config = token instanceof Object ? token : { token };
            this.additionalAccounts.push(this.createVk(Object.assign({}, vk, config)));
        });
        this.groupAccounts = [];
        groupTokens.map(token => {
            let config = token instanceof Object ? token : { token };
            this.groupAccounts.push(this.createVk(Object.assign({}, vk, config)));
        });
        console.log('all accs', this.additionalAccounts.length);
        console.log('group accs', this.groupAccounts.length);
        /**
         *
         * @type {Array<ModuleEventController>}
         */
        this.modules = [];
        /**
         *
         * @type {Array<CoreModuleEventController>}
         */
        this.coreModules = [];
        /**
         * @class {Chat}
         */
        this.Chat = Chat.setBot(this);
        /**
         * @class {Message}
         */
        this.Message = Message.setBot(this);

        this.emitLogs = bot.emitLogs || false;

        process.on('SIGINT', () => {
            this.stop()
                .then(() => process.exit(0))
                .catch(() => process.exit(1))
        });
    }


    createVk(options = {}, addProxy = true) {
        let vk = new VK(options);
        if (options.type) {
            vk.type = options.type;
        }
        return vk
    }

    _initDB() {
        mongoose.Promise = global.Promise;
        mongoose.connect(this.config.db.uri + this.config.db.name + this.selfId, { config: { autoIndex: true } });
    }

    _initVk() {
        this.vk.longpoll.setMaxListeners(0);
        // let promises = this.additionalAccounts.map(vk => {
        //     return vk.api.users.get()
        //         .then((info) => {
        //             if (!info[0] || !info[0].id) {
        //                 this.additionalAccounts.splice(this.additionalAccounts.indexOf(vk), 1);
        //                 throw new Error(`no self id for additional bot`);
        //             }
        //             vk.selfId = info[0].id;
        //             console.log('additional account', vk.selfId, vk.options.token.slice(0, 8));
        //             if (!this.admins.includes(vk.selfId)) this.admins.push(vk.selfId);
        //         })
        //         .catch(console.error)
        // }).concat(this.groupAccounts.map(vk => {
        //     return vk.api.groups.getById()
        //         .then((info) => {
        //             if (!info[0] || !info[0].id) {
        //                 this.groupAccounts.splice(this.groupAccounts.indexOf(vk), 1);
        //                 throw new Error(`no self id for additional group bot`);
        //             }
        //             vk.group_id = info[0].id;
        //             console.log('additional group account', vk.group_id, vk.options.token.slice(0, 8));
        //             if (!this.admins.includes(vk.group_id)) this.admins.push(vk.group_id);
        //             vk.longpoll.on('error', e => {
        //                 console.error(e);
        //                 setTimeout(() => vk.longpoll.restartGroups(), 5e3);
        //             });
        //            // vk.longpoll.on("message")
        //
        //
        //         })
        //         .catch(console.error)
        // }))
        return (this.vk.type === 'group'
            ? this.vk.api.groups.getById()
            : this.vk.api.users.get()
        )
            .then((info) => {
                this.selfId = this.vk.selfId = info[0] && info[0].id;
                console.log('self id', this.selfId);
                if (!this.selfId) throw new Error(`no self id`);
                if (this.vk.type === 'group') {
                    this.selfId = this.vk.selfId = (-1) * this.vk.selfId
                }
            })
            .then(() => {
                if (!this.admins.includes(this.selfId)) this.admins.push(this.selfId);
                this.vk.longpoll.on('error', e => {
                    console.error(e);
                    setTimeout(() => this.vk.longpoll.restart(), 5e3);
                });
                for (let event of this._allEvents) {
                    this.vk.longpoll.on(event, (...args) => this._onAll(event, ...args))
                }
            })
            .catch(console.error)
    }

    _initCoreModules() {
        let promiseEvents = [];
        for (let module of this.config.coreModules) {
            promiseEvents.push(() => this.addCoreModule(module));
        }
        return promiseFactory.allSync(promiseEvents);
    }

    _initModules() {
        let promiseEvents = [];
        for (let module of this.config.modules) {
            promiseEvents.push(() => this.addModule(module));
        }
        return promiseFactory.allSync(promiseEvents);
    }

    /**
     *
     * @param {Number} [dialogsCount]
     * @private
     */
    _initChats(dialogsCount = 20) {
        return promiseFactory.allAsync(this._allEvents.map(
            event =>
                this.on(this.eventNames[event], (...args) => this._onMessage(this.eventNames[event], ...args))
            )
        )
    }

    _initLongPoll() {
        return (
            this.vk.type === 'group'
                ? this.vk.longpoll.startGroups()
                : this.vk.longpoll.start()
        )
            .catch((err) => (
                console.log(err)
            ))
    }

    _initLongPollGroups() {
        return this.groupAccounts.map(vk => vk.longpoll.startGroups());
        console.log("botinit2",this.vk.options.token);
        promises.push(
            this.vk.longpoll.startGroups()
                .catch((err) => (
                    this.vk.longpoll.restartGroups()
                ))
                .catch((err) => (
                    console.log(err)
                ))
        );
        return promiseFactory.allAsync(promises);
    }

    _initExpress() {
        this.app = express();
        this.app.use(cookieParser());
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded());
        this.appServer = this.app.listen(this.config.express.port, () => {
            console.log('Bot app start on port ' + this.config.express.port);
        })
    }

    _finalDB() {
        return mongoose.disconnect();
    }

    _finalVk() {
        return this.vk.longpoll.stop();
    }

    _finalCoreModules() {
        let promiseEvents = [];
        for (let module of this.coreModules) {
            promiseEvents.push(module.stop());
        }
        return promiseFactory.allAsync(promiseEvents);
    }

    _finalModules() {
        let promiseEvents = [];
        for (let module of this.modules) {
            promiseEvents.push(module.stop());
        }
        return promiseFactory.allAsync(promiseEvents);
    }

    _finalChats() {
        let promiseEvents = [];
        for (let id of Object.keys(this.chats)) {
            promiseEvents.push(this.chats[id].final());
        }
        return promiseFactory.allAsync(promiseEvents);
    }

    /**
     *
     * @returns {Array<String>}
     */
    get _allEvents() {
        return ['message', 'chat.action', 'chat.create', 'chat.rename', 'chat.invite',
            'chat.kick', 'chat.photo.update', 'chat.photo.remove', 'chat.pin', 'chat.unpin'];
        // return ['message.flag.replace', 'message.flag.set', 'message.flag.remove', 'message',
        //     'message.read.inbox', 'message.read.outbox', 'message.removed', 'chat.action',
        //     'typing.chat', 'chat.create', 'chat.rename', 'chat.invite', 'chat.kick', 'chat.photo.update',
        //     'chat.photo.remove'];
    }

    /**
     *
     * @returns {{create: string, emit: string, noNameEvent: string, newListenerPre: string, newListenerOn: string,
     *     newListenerAfter: string, newMiddlewarePre: string, newMiddlewareOn: string, removeListenerPre: string,
     *     removeListenerOn: string, removeListenerAfter: string, removeMiddlewarePre: string, removeMiddlewareOn:
     *     string, message.flag.replace: string, message.flag.set: string, message.flag.remove: string, message:
     *     string, message.read.inbox: string, message.read.outbox: string, message.removed: string, chat.action:
     *     string, typing.chat: string, chat.create: string, chat.rename: string, chat.invite: string, chat.kick:
     *     string, chat.photo.update: string, chat.photo.remove: string,
     *     initVk: string, initDB: string, initCoreModules: string, initModules: string, initChats: string, initLongPoll: string,
     *     addCoreModule: string, addModule: string, removeCoreModule: string, removeModule: string, createChat:
     *     string, removeChat: string}}
     */
    get eventNames() {
        let eventNames = super.eventNames;
        eventNames.initVk = 'initVk';
        eventNames.initDB = 'initDB';
        eventNames.initCoreModules = 'initCoreModules';
        eventNames.initModules = 'initModules';
        eventNames.initChats = 'initChats';
        eventNames.initLongPoll = 'initLongPoll';
        eventNames.initLongPollGroups = 'initLongPollGroups';
        eventNames.initExpress = 'initExpress';
        eventNames.addCoreModule = 'addCoreModule';
        eventNames.addModule = 'addModule';
        eventNames.removeCoreModule = 'removeCoreModule';
        eventNames.removeModule = 'removeModule';
        eventNames.createChat = 'createChat';
        eventNames.removeChat = 'removeChat';
        this._allEvents.map((name) => eventNames[name] = name);
        return eventNames;
    }

    /**
     *
     * @param {String} event
     * @param {BaseMessage} info
     * @param {...*} args
     * @private
     */
    _onMessage(event, info, ...args) {
        if (!info) return;
        let id = info.peer || (info.chat + 2e9);
        if (id > 4e9) id -= 2e9;
        if (isNaN(id) || id in this.chats) return;
        if (this.config.bot.dev) {
            let dev = this.config.bot.dev;
            if (Array.isArray(dev.chats) && !dev.chats.includes(id)) return;
        }
        if (!(this.createChats[id]) && (this.createChats[id] = true)) {
            this.createChats[id] = [[event, info, ...args]];
            this.createChat(id).then((chat) => {
                if (chat && this.createChats[id]) {
                    let result = this.pause || Promise.resolve();
                    for (let args of this.createChats[id]) {
                        result = result.then(() => chat.onAll(...args));
                    }
                    this.createChats[id] = [];
                } else {
                    if (id in this.createChats) this.createChats[id] = true;
                }
            }).catch(console.error);
        } else if (Array.isArray(this.createChats[id])) {
            this.createChats[id].push([event, info, ...args]);
        }
    }

    _onAll(event, ...args) {
        if (!this.pause)
            return this.emit(event, ...args);
        else return this.pause = this.pause.then(() => this.emit(event, ...args));
    }

    _checkLongpoll() {
        let text = 'test' + Math.random() * 1e5;
        let self = this;
        let timeout;
        let check = message => {
            if (message.peer === this.selfId && message.user === this.selfId && message.text === text) {
                self.vk.longpoll.removeListener('message', check);
                clearTimeout(timeout);
            }
        };
        timeout = setTimeout(() => {
            this.vk.longpoll.removeListener('message', check);
            this.vk.longpoll.stop().then(() => this.vk.longpoll.start());
            console.log('longpoll restarted');
        }, 1e4);
        this.vk.longpoll.on('message', check);
        return new Message(this, { peer: this.selfId }).setTitle(text).send().catch(console.error);
    }

    addCoreModule(module) {
        if (this.coreModules.includes(module)) return Promise.resolve(null);
        return this.ctrlEmit((module) => {
            return module.init(this).then(result => {
                if (result !== null) {
                    this.coreModules.push(module);
                    return true;
                } else return null;
            });
        }, this.eventNames.addCoreModule, module);
    }

    addModule(module) {
        if (this.modules.includes(module)) return Promise.resolve(null);
        return this.ctrlEmit((module) => {
            return module.init(this).then(result => {
                if (result !== null) {
                    this.modules.push(module);
                    return true;
                } else return null;
            });
        }, this.eventNames.addModule, module);
    }

    removeCoreModule(module) {
        if (!this.coreModules.includes(module)) return Promise.resolve(false);
        return this.ctrlEmit((module) => {
            let i = this.coreModules.indexOf(module);
            return promiseFactory.funToPromise(() => this.coreModules[i].final())
                .then(() => delete this.coreModules[i])
        }, this.eventNames.removeCoreModule, module);
    }

    removeModule(module) {
        if (!this.modules.includes(module)) return Promise.resolve(false);
        return this.ctrlEmit((module) => {
            let i = this.modules.indexOf(module);
            return promiseFactory.funToPromise(this.modules[i].final)
                .then(() => delete this.modules[i])
        }, this.eventNames.removeModule, module);
    }

    /**
     *
     * @param {Number} id
     * @returns {Promise.<Chat>}
     */
    createChat(id) {
        if (id < 2e9) return Promise.resolve(null);
        let chat = new Chat(this, id);
        return this.ctrlEmit((chat) => {
            if (id in this.chats) return this.chats[id];
            return chat.init().then(result => {
                if (result !== null)
                    this.chats[chat.id] = chat;
                return this.chats[chat.id];
            });
        }, this.eventNames.createChat, chat);
    }

    /**
     *
     * @param {Number} id
     * @returns {Promise.<Chat>}
     */
    removeChat(id) {
        let chat = this.chats[id];
        if (!chat) return Promise.resolve(null);
        return this.ctrlEmit(chat => {
            if (!chat) return null;
            console.log('remove chat', chat.id);
            delete this.chats[chat.id];
            delete this.createChats[chat.id];
            return chat.final().then(() => chat);
        }, this.eventNames.removeChat, chat)
    }

    /**
     *
     * @param {String} name
     * @returns {boolean}
     */
    isBotName(name) {
        if (!name) return false;
        if (Array.isArray(this.name)) {
            for (let n of this.name) {
                if (new RegExp(`^[^\w\dа-яё]?${n}[^\w\dа-яё]?$`, 'ig').test(name)) {
                    return true;
                }
            }
        } else {
            return new RegExp(`^[^\w\dа-яё]?${this.name}[^\w\dа-яё]?$`, 'ig').test(name);
        }
    }

    /**
     *
     * @returns {String}
     */
    getBotName() {
        if (Array.isArray(this.name)) {
            return this.name[0];
        } else {
            return this.name;
        }
    }

    /**
     *
     * @returns {Promise.<*>}
     */
    start() {
        this.setPause(false);
        this.ctrlEmit(() => this._initVk(), this.eventNames.initVk)
            .then(() => (
                this.ctrlEmit(() => this._initDB(), this.eventNames.initDB)
            ))
            .then(() => this.ctrlEmit(() => this._initExpress(), this.eventNames.initExpress))
            .then(() => (
                this.ctrlEmit(() => this._initCoreModules(), this.eventNames.initCoreModules)
            ))
            .then(() => (
                this.ctrlEmit(() => this._initModules(), this.eventNames.initModules)
            ))
            .then(() => (
                this.ctrlEmit(() => this._initChats(), this.eventNames.initChats)
            ))
            .catch((err) => (
                console.error(err)
            ))
            .then(() => this.ctrlEmit(() => this._initLongPoll(), this.eventNames.initLongPoll))
            // .then(() => this.ctrlEmit(() => this._initLongPollGroups(), this.eventNames.initLongPollGroups))
            .then(() => {
                console.log('start bot');
                // process.send('ready');
            })
    }

    setPause(set = true) {
        if (set) {
            let time = Date.now();
            if (!this.pause)
                console.log('start pause');
                this.pause = new Promise((resolve, reject) => {
                    this.pauseResolve = resolve;
                    this.pauseReject = reject;
                }).then(() => Date.now() - time);
            return this.pause;
        } else {
            let pause = this.pause;
            this.pause = false;
            if (this.pauseResolve instanceof Function) {
                this.pauseResolve();
                this.pauseResolve = undefined;
                this.pauseReject = undefined;
            } else pause = Promise.resolve();
            return pause.then(() => console.log('stop pause'));
        }
    }

    /**
     *
     * @returns {Promise.<void>}
     */
    stop() {
        this.setPause();
        return Promise.resolve()
            // .then(() => this._finalChats())
            // .then(() => console.log('final chats'))
            .then(() => this._finalModules())
            .then(() => console.log('final modules'))
            .then(() => this._finalCoreModules())
            .then(() => console.log('final core modules'))
            .then(() => this._finalVk())
            .then(() => console.log('final vk'))
            .then(() => this._finalDB())
            // .then(() => this.pauseReject && this.pauseReject())
            .then(() => console.log('bot stopped'))
    }
}

module.exports = Bot;
