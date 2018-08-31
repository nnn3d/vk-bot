'use strict';

const CoreModuleEventController = require('../../classes/base/CoreModuleEventController');
const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const pm2 = require('pm2');

module.exports = class ClusterMode extends CoreModuleEventController {

    /**
     * @typedef {Object} Specification_ClusterMode
     * @property {((function(chat:Chat):Boolean|Promise<Boolean>)|Boolean)} [removeModule]
     * @property {Boolean} [onlyOne]
     */

    constructor() {
        super();
        this.createChats = [];
        this.createChatsPromises = {};
        this.instances = +process.env.instances;
        this.isCluster = this.instances !== 1;
        this.instanceNum = +process.env.pm_id;
        this.firstMaster = true;
        console.log(`start bot in cluster mode, instances: ${this.instances}, this num: ${this.instanceNum}`);

        this.workers = [];
        this.sendPromise = Promise.resolve();
        // this.reconnectInterval = setInterval(() => {
        //     this.sendPromise = new Promise((resolve, reject) => {
        //         pm2.disconnect(() => pm2.connect(resolve));
        //     })
        // }, 6e4);
    }

    _updateWorkers() {
        this.sendPromise = new Promise(resolve => {
            pm2.connect((err) => {
                if (err) console.error(err);
                pm2.list((err, data) => {
                    if (err) console.error(err);
                    for (let i in data) {
                        if (data.hasOwnProperty(i)) {
                            this.workers.push(data[i].pm2_env.pm_id);
                        }
                    }
                    console.log('ins:', this.instances);
                    // pm2.disconnect(resolve);
                    resolve();
                });
            });
        });
        return this.sendPromise;
    }

    _init(bot) {
        this.bot = bot;
        if (!this.isCluster) return;
        this.bot.clusterMode = {
            instances: this.instances,
            instanceNum: this.instanceNum,
            send: this.send.bind(this),
            isClusterChat: this._isClusterChat.bind(this),
        };
        process.on('message', packet => this._onProcessMessage(packet));
        return promiseFactory.allAsync([
            promiseFactory.allAsync([
                bot._allEvents.map(eventName => bot.pre(eventName, this._preMessage, this))
            ]),
            bot.Message.global.pre(bot.Message.eventNames.send, this._preMessageSend, this),
            bot.pre(bot.eventNames.initLongPoll, this._preInitLongPoll, this),
            bot.pre(bot.eventNames.createChat, this._preCreateChat, this),
            bot.after(bot.eventNames.createChat, this._afterChatInit, this),
            bot.after(bot.eventNames.removeChat, this._afterRemoveChat, this),
            bot.pre(bot.eventNames['chat.invite'], this._preClusterChatEvent.bind(this, '_onInvite'), this),
            bot.pre(bot.eventNames['chat.kick'], this._preClusterChatEvent.bind(this, '_onKick'), this),
            bot.pre(bot.eventNames['chat.rename'], this._preClusterChatEvent.bind(this, '_onRename'), this),
            ModuleEventController.global.pre(this.eventNames.initChat, this._preModuleInitChat, this),
            CoreModuleEventController.global.pre(this.eventNames.initChat, this._preModuleInitChat, this),
            bot.Chat.global.pre(bot.Chat.eventNames.init, this._preInitChat, this),
            bot.Chat.global.pre(bot.Chat.eventNames.updateChatInfo, this._preInitChat, this),
            bot.Chat.global.after(bot.Chat.eventNames.updateChatInfo, this._afterChatInit, this),
            this._updateWorkers(),
        ]);

    }

    _final() {
        if (!this.isCluster) return;
        return promiseFactory.allAsync([
            promiseFactory.allAsync([
                bot._allEvents.map(eventName => bot.removeListenersPreByHandler(eventName, this))
            ]),
            bot.Message.global.removeListenersPreByHandler(bot.Message.eventNames.send, this),
            bot.removeListenersPreByHandler(bot.eventNames.initLongPoll, this),
            bot.removeListenersAfterByHandler(bot.eventNames.createChat, this),
            bot.removeListenersAfterByHandler(bot.eventNames.removeChat, this),
            // bot.removeListenersPreByHandler(bot.eventNames.message, this),
            bot.removeListenersAfterByHandler(bot.eventNames.removeChat, this),
            bot.removeListenersPreByHandler(bot.eventNames['chat.invite'], this),
            bot.removeListenersPreByHandler(bot.eventNames['chat.kick'], this),
            bot.removeListenersPreByHandler(bot.eventNames['chat.rename'], this),
            bot.Chat.global.removeListenersPreByHandler(bot.eventNames.init, this),
            ModuleEventController.global.removeListenersPreByHandler(this.eventNames.initChat, this),
            CoreModuleEventController.global.removeListenersPreByHandler(this.eventNames.initChat, this),
        ])
    }

    _preInitChat(chat) {
        if (this._isClusterChat(chat.id)) throw 'dont init cluster chat';
    }

    _preClusterChatEvent(funName, info) {
        let chatId = info.peer || info.chat + 2e9;
        if (!this._isClusterChat(chatId)) return;
        let result = Promise.resolve();
        if (this.bot.chats[chatId]) result = this.bot.chats[chatId][funName](info);
        return result;
    }

    _preCreateChat(chat) {
        let chatId = chat.id;
        if (this._isClusterChat(chatId) && !(chatId in this.bot.chats)) {
            if (!this.createChatsPromises[chatId]) {
                this.createChatsPromises[chatId] = {};
                this.createChatsPromises[chatId].promise = new Promise(resolve => {
                    this.createChatsPromises[chatId].resolve = resolve;
                });
                this.send({
                    topic: 'clusterModeCreateChat',
                    data: chatId,
                });
            }
            return this.createChatsPromises[chatId].promise;
            // throw `don't create cluster chat ${chat.id}`;
        }
    }

    _afterChatInit(chat) {
        if (this._isClusterChat(chat.id) || !this.bot.chats[chat.id]) return;
        let userNames = {};
        chat.allUsers.map(id => {
            userNames[id] = {
                name: chat.userNames[id].name,
                secondName: chat.userNames[id].secondName,
            };
        });
        this.send({
            topic: 'clusterModeAfterChatInit',
            data: {
                id: chat.id,
                chatInfo: {
                    users: chat.users,
                    allUsers: chat.allUsers,
                    title: chat.title,
                    adminId: chat.adminId,
                    adminsId: chat.adminsId,
                    disabled: chat.disabled,
                    name: chat.name,
                    secondName: chat.secondName,
                },
                userNames,
                modules: chat.modules.map(module => module.specification.name),
            }
        })
    }

    _afterRemoveChat(chat, result) {
        if (!chat || !result) return;
        this.send({
            topic: 'clusterModeAfterRemoveChat',
            data: chat.id,
        })
    }


    send(packet) {
        return this.sendPromise.then(() => {
            // pm2.connect(() => {
                // return promiseFactory.allAsync(
                    this.workers.map(i => {
                        // return new Promise(resolve => {
                            pm2.sendDataToProcessId(this.workers[i], packet, (err, res) => {
                                if (err) console.error(err);
                                // resolve();
                            });
                        // })
                    })
                // );
            // pm2.disconnect(() => {});
            // });
        });
    }

    _onProcessMessage(packet) {
        if (!(packet instanceof Object)) return;
        if (packet.topic === 'clusterModeLongPoll') {
            const method = this.bot.vk.type === 'group' ? '_restructureGroups' : '_restructure';
            if (this.instanceNum !== 0) {
                if (packet.data.self) this.bot.vk.longpoll[method](packet.data.event);
                else this.bot.additionalAccounts[packet.data.num].longpoll[method](packet.data.event);
            }
        } else if (packet.topic === 'clusterModeAfterChatInit') {
            if (!this._isClusterChat(packet.data.id) || this.bot.chats[packet.data.id]) return;
            let chat = new this.bot.Chat(packet.data.id);
            Object.keys(packet.data.chatInfo).map(name => chat[name] = packet.data.chatInfo[name]);
            Object.keys(packet.data.userNames).map(id => chat.userNames[id] = packet.data.userNames[id]);
            this.bot.modules.concat(this.bot.coreModules).forEach(module => {
                if (packet.data.modules.includes(module.specification.name)) {
                    chat.modules.push(module);
                    module.chats.push(chat);
                }
            });
            this.bot.chats[packet.data.id] = chat;
            if (this.createChatsPromises[packet.data.id]) {
                this.createChatsPromises[packet.data.id].resolve();
            }
        } else if (packet.topic === 'clusterModeGetChatInfo') {
            if (!this._isClusterChat(packet.data) && this.bot.chats[packet.data]) {
                this._afterChatInit(this.bot.chats[packet.data]);
            }
        } else if (packet.topic === 'clusterModeAfterRemoveChat') {
            if (this.createChats.includes(packet.data)) {
                this.createChats.splice(this.createChats.indexOf(packet.data), 1);
            }
            this.bot.removeChat(packet.data);
        } else if (packet.topic === 'clusterModeCreateChat') {
            if (this._isClusterChat(packet.data)) return;
            if (this.bot.chats[packet.data]) {
                this._afterChatInit(this.bot.chats[packet.data]);
            } else {
                this.bot.createChat(packet.data);
            }
        } else if (packet.topic === 'clusterModeSendMessage') {
            if (this._isClusterChat(+packet.data.peer)) return;
            console.log(packet.data);
            let message = new this.bot.Message(+packet.data.peer);
            message._send(packet.data.params);
        }
    }

    _sendLongPoll(event, num) {
        this.send({
            topic: 'clusterModeLongPoll',
            data: {
                self: num === undefined,
                event,
                num,
            }
        })
    }

    _isClusterChat(chatId) {
        let num = this.instanceNum;
        let instances = this.instances;
        if (this.firstMaster) {
            if (num === 0) return true;
            num--;
            instances--;
        }
        return (chatId % instances) !== num;
    }

    _preInitLongPoll() {
        if (this.isCluster && this.instanceNum !== 0) {
            throw `don't need to start longpoll on this processor (${this.instanceNum})`;
        } else if (this.isCluster) {
            this.bot.additionalAccounts.map((vk, num) => vk.longpoll.on('raw', event => this._sendLongPoll(event, num)));
            this.bot.vk.longpoll.on('raw', event => this._sendLongPoll(event));
        }
    }

    _preModuleInitChat(chat, module) {
        if (!this._isClusterChat(chat.id)
            || !module.specification.clusterMode || !('removeModule' in module.specification.clusterMode))
            return;
        let removeModule = module.specification.clusterMode.removeModule;
        if (!(removeModule instanceof Function)) removeModule = () => module.specification.clusterMode.removeModule;
        return Promise.resolve(removeModule(chat)).then(remove => {
            let result = Promise.resolve();
            if (remove || module.chats.includes(chat) || (module.specification.type && chat.type !== module.specification.type)) {
                result = chat.removeModule(module);
            }
            return result.then(() => { throw `this is cluster chat, don't init` });
        })
    }

    _preMessageSend(params, message) {
        if (this._isClusterChat(message.peer)) {
            this.send({
                topic: 'clusterModeSendMessage',
                data: {
                    peer: message.peer,
                    params,
                },
            });
            throw `don't send message from cluster chat`;
        }
    }

    _preMessage(message) {
        let chatId = message.peer || message.chat + 2e9;
        if (this._isClusterChat(chatId)) {
            if (!this.createChats.includes(chatId)) {
                this.createChats.push(chatId);
                this.send({
                    topic: 'clusterModeGetChatInfo',
                    data: chatId,
                });
            }
            throw `this message from chat ${chatId} not for this cluster`;
        }
    }

};
