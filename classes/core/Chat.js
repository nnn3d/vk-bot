'use strict';

const BaseEventController = require('../base/BaseEventController');
const StandardEventController = require('../base/StandardEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const Message = require('./Message');

let defaultBot;

class Chat extends StandardEventController {

    /**
     *
     * @param {Bot} [bot]
     * @param {Number} [id]
     * @return {*}
     */
    constructor(bot, id) {
        super();
        if (!(bot instanceof BaseEventController)) {
            if (defaultBot) {
                this.bot = defaultBot;
            } else {
                throw new Error('no bot in new chat constructor');
            }
            id = bot;
        } else {
            this.bot = bot;
        }
        this.id = id;
        this.adminId = 0;
        this.adminsId = [0];
        this.disabled = true;
        this.title = '';
        this.name = '';
        this.secondName = '';
        this.type = id > 2e9 ? 'chat' : (id < 0 ? 'group' : 'dm');
        this.users = [];
        this.allUsers = [];
        let self = this;

        /**
         *
         * @type {Object<{name: String, secondName: String, ?fullName: String}>}
         */
        this.userNames = new Proxy({}, {
            get(target, property) {
                if (typeof property === 'symbol' || isNaN(property)) return target[property];
                if (!target[property] && property in self.users) {
                    self.bot.vk.api.users.get({ user_ids: property })
                        .then(users => {
                            let user = users[0];
                            self.userNames[property].name = user.first_name || user.name;
                            self.userNames[property].secondName = user.last_name;
                        })
                        .catch(err => {
                            console.error(err);
                            target[property] = undefined;
                        });
                    target[property] = {};
                }
                if (!target[property]) target[property] = {};
                let info = target[property];
                if (!info.name) info.name = self.name || property;
                if (!info.secondName) info.secondName = self.secondName || '';
                info.fullName = info.name + (info.secondName && ` ${info.secondName}` || '');
                return info;
            }
        });
        /**
         *
         * @type {Array<ModuleEventController|CoreModuleEventController>}
         */
        this.modules = [];

        this.maxMessageLength = 400;
    }

    static setBot(bot) {
        defaultBot = bot;
        return this;
    }

    /**
     *
     * @returns {{create: string, emit: string, noNameEvent: string, newListenerPre: string, newListenerOn: string,
     *     newListenerAfter: string, newMiddlewarePre: string, newMiddlewareOn: string, removeListenerPre: string,
     *     removeListenerOn: string, removeListenerAfter: string, removeMiddlewarePre: string, removeMiddlewareOn:
     *     string, init: string, final: string, addUser: string, removeUser: string, addModule: string, removeModule:
     *     string, updateChatInfo: string, message.flag.replace: string, message.flag.set: string,
     *     message.flag.remove: string, message: string, message.read.inbox: string, message.read.outbox: string,
     *     message.removed: string, chat.action: string, typing.chat: string, chat.create: string, chat.rename: string,
     *     chat.invite: string, chat.kick: string, chat.photo.update: string, chat.photo.remove: string}}
     */
    get eventNames() {
        let eventNames = super.eventNames;
        eventNames.init = 'init';
        eventNames.final = 'final';
        eventNames.addUser = 'addUser';
        eventNames.removeUser = 'removeUser';
        eventNames.addModule = 'addModule';
        eventNames.removeModule = 'removeModule';
        eventNames.updateChatInfo = 'updateChatInfo';
        this._allEvents.map((name) => eventNames[name] = name);
        return eventNames;
    }

    /**
     *
     * @param {Number} userId
     * @returns {Promise.<*>}
     */
    addUser(userId) {
        if (!this.allUsers.includes(userId)) this.allUsers.push(userId);
        return this.ctrlEmit((userId) => {
            if (!this.users.includes(userId) && this.bot.selfId !== userId && userId > 0) {
                this.users.push(userId);
            } else return null;
        }, this.eventNames.addUser, userId);
    }

    /**
     *
     * @param {Number} userId
     * @returns {Promise.<*>}
     */
    removeUser(userId) {
        if (this.allUsers.includes(userId)) this.allUsers.splice(this.allUsers.indexOf(userId), 1);
        return this.ctrlEmit((userId) => {
            if (this.users.includes(userId)) {
                this.users.splice(this.users.indexOf(userId), 1);
            } else return null;
        }, this.eventNames.removeUser, userId);
    }

    /**
     *
     * @param {ModuleEventController} module
     * @returns {Promise.<*>}
     */
    addModule(module) {
        return this.ctrlEmit((module) => {
            if (!this.modules.includes(module)) {
                this.modules.push(module);
                return module.initChat(this);
            }
        }, this.eventNames.addModule, module);
    }

    /**
     *
     * @param {ModuleEventController} module
     * @returns {Promise.<*>}
     */
    removeModule(module) {
        return this.ctrlEmit((module) => {
            if (this.modules.includes(module)) {
                this.modules.splice(this.modules.indexOf(module), 1);
                return module.finalChat(this);
            }
        }, this.eventNames.removeModule, module);
    }

    onAll(event, info) {
        if (!info) return;
        let peer = info.peer || info.chat + 2e9;
        if (this.id === peer) {
            if (['BaseMessage', 'ChatEvent', 'Message'].includes(info.__proto__.constructor.name)) {
                if (info.user < 0) return;
                info = this.bot.Message.createFromEventMessage(this.bot, info);
                if (info.text) {
                    info.text = info.text.replace(/ +/g, ' ');
                    info.text = info.text.trim();
                    if (this.bot.vk.type === 'group') {
                        if (info.text.startsWith(`[club${Math.abs(this.bot.vk.selfId)}|`)) {
                            info.text = info.text.replace(new RegExp(`^\\[club${Math.abs(this.bot.vk.selfId)}\\|[^\\]]+]`), this.bot.getBotName())
                        }
                    }
                    info.text = info.text.replace(/["'{}()]/g, ' ');
                    // info.text = info.text.replace(/\./g, '. ');
                }
                let promise = Promise.resolve();
                if (!this.allUsers.includes(info.user)) {
                    console.log('load user', info.user, 'from chat', info.peer);
                    promise = this._onInvite(info);
                }
                return promise.then(() => this.emit(event, info));
            } else return this.emit(event, info);
        }
    }

    _onInvite(info) {
        let userId = info.invite || info.user;
        if (info.peer === this.id) {
            return this.bot.vk.api.users.get({ user_ids: userId })
                .then((users) => {
                    let user = users[0];
                    if (user) {
                        this.userNames[userId].name = user.first_name || user.name;
                        this.userNames[userId].secondName = user.last_name;
                    }
                    return this.addUser(userId)
                });
        }
    }

    _onKick(info) {
        if (info.peer === this.id) {
            return this.removeUser(info.kick).then(removed => {
                if (removed !== null) {
                    // delete this.userNames[info.kick];
                }
            });
        }
    }

    _onRename(info) {
        if (info.peer === this.id)
            this.title = info.title;
    }

    /**
     *
     * @param {Boolean} log
     * @returns {Promise}
     * @private
     */
    _updateChatInfo(log = true) {
        if (this.type !== 'chat') return Promise.resolve(null);
        return this.ctrlEmit(() => {
            if (log) console.log('update chat', this.id, 'info');
            return promiseFactory.allAsync([
                this.bot.vk.api.call('messages.getConversationsById', {
                    peer_ids: this.id,
                    extended: 1,
                    fields: 'nickname',
                }),
                this.bot.vk.api.call('messages.getConversationMembers', {
                    peer_id: this.id,
                    fields: 'nickname',
                })
            ]).then(([chatInfo, usersInfo]) => {
                chatInfo = chatInfo.items[0];
                if (!chatInfo || !usersInfo) {
                    this.disabled = true;
                    return;
                }
                this.disabled = false;
                let users = usersInfo.items.map(userInfo => userInfo.member_id);
                let promiseEvents = [];
                this.users.forEach(user => {
                    if (!users.includes(user)) promiseEvents.push(this.removeUser(user));
                });
                users.forEach(user => {
                    if (!this.users.includes(user)) promiseEvents.push(this.addUser(user));
                });
                this.title = chatInfo.chat_settings.title;
                this.adminsId = usersInfo.items.filter(user => user.is_admin && user.member_id > 0).map(user => user.member_id);
                this.adminId = this.adminsId[0];
                return promiseFactory.allAsync(promiseEvents).then(() => {
                    for (let user of usersInfo.profiles) {
                        this.userNames[user.id].name = user.first_name;
                        this.userNames[user.id].secondName = user.last_name;
                    }
                    for (let group of usersInfo.groups) {
                        this.userNames[-group.id].name = group.name;
                    }
                });
            });
        }, this.eventNames.updateChatInfo);
    }

    /**
     *
     * @returns {Array<String>}
     * @private
     */
    get _allEvents() {
        return ['message', 'chat.action', 'chat.create', 'chat.rename', 'chat.invite',
            'chat.kick', 'chat.photo.update', 'chat.photo.remove', 'chat.pin', 'chat.unpin'];
        // return ['message.flag.replace', 'message.flag.set', 'message.flag.remove', 'message',
        //     'message.read.inbox', 'message.read.outbox', 'message.removed', 'chat.action',
        //     'typing.chat', 'chat.create', 'chat.rename', 'chat.invite', 'chat.kick', 'chat.photo.update',
        //     'chat.photo.remove'];
    }

    _init() {
        console.log('init chat ', this.id);
        let promises = [];
        this._allEvents.forEach((event) => {
            promises.push(this.bot.on(event, (...args) => this.onAll(event, ...args), this));
        });
        if (this.type !== 'chat') {
            this.users = [this.id];
            return this.bot.vk.api.users.get({ user_ids: this.id })
                .then(users => {
                    let user = users[0];
                    this.name = user.first_name;
                    this.secondName = user.last_name;
                    this.title = `${this.name} ${this.secondName}`;
                });
        }
        promises.push(this.on(this.eventNames['chat.invite'], this._onInvite, this));
        promises.push(this.on(this.eventNames['chat.kick'], this._onKick, this));
        promises.push(this.on(this.eventNames['chat.rename'], this._onRename, this));
        promises.push(this._updateChatInfo(false));
        return promiseFactory.allAsync(promises);
    }

    _final() {
        let promises = [];
        this._allEvents.forEach((event) => {
            promises.push(this.bot.removeListenersOnByHandler(event, this));
        });
        promises.push(this.removeListenersOnByHandler(this.eventNames['chat.invite'], this));
        promises.push(this.removeListenersOnByHandler(this.eventNames['chat.kick'], this));
        promises.push(this.removeListenersOnByHandler(this.eventNames['chat.kick'], this));
        return promiseFactory.allAsync(promises);
    }

    init() {
        return this.ctrlEmit(() => this._init(), this.eventNames.init);
    }

    final() {
        return this.ctrlEmit(() => this._final(), this.eventNames.final);
    }


    findUser(nameOrId) {
        let userId;
        if (!nameOrId) return;
        if (this.users.includes(+nameOrId)) return +nameOrId;
        let nameExp = new RegExp(`^${nameOrId}`, 'i');
        this.users.forEach(user => {
            if (nameExp.test(`${this.userNames[user].name} ${this.userNames[user].secondName}`)
                || nameExp.test(`${this.userNames[user].secondName} ${this.userNames[user].name}`)
                || nameExp.test(user)) {
                userId = user;
            }
        });
        return userId;
    }

}

module.exports = Chat;
