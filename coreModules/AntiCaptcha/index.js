'use strict';

const CoreModuleEventController = require('../../classes/base/CoreModuleEventController');
const ModuleEventController = require('../../classes/base/ModuleEventController');
const pf = require('../../helpers/promiseFactory');
const request = require('request').defaults({ encoding: null });
const AntiCaptchaBotChats = require('./AntiCaptchaBotChats');

module.exports = class AntiCaptcha extends CoreModuleEventController {

    /**
     * @typedef {Object} SpecificationCommand_AntiCaptcha
     * @property {Boolean} [selfDirect]
     *
     */

    constructor({token, onlyAdditional = false} = {}) {
        super();
        this.token = token;
        this.chatBots = {};
        this.bots = {};
        this.antiCaptcha = require('./anticaptcha')(this.token);
        this.onlyAdditional = onlyAdditional;
        this.solvePromise = Promise.resolve();
        this.solveNow = false;
        this.intervals = [];
        this.botsToAddToChat = {};
        this.maxCaptchaFromTime = 10;
        this.maxCaptchaTime = 12e4;
        this.findBotTimeout = 6e5;
        this.linkBotCount = 3;
        this.floodControlTimeout = 3;
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

    _getVkBots() {
        let opts = {
            solve: false,
            ban: false,
            solveResolve: null,
            captchaLastMinute: 0,
            captchaRetry: null,
            retryTimeout: null,
            unbanTimeout: null,
            countMessages: 0,
            countChats: 0,
        };
        this.captchaClearCountInterval = setInterval(
            () => {
                Object.keys(this.bots)
                    .map(id => {
                        this.bots[id].captchaLastMinute = 0;
                        this.bots[id].countMessages = Math.round(this.bots[id].countMessages / 10);
                    });
            },
            this.maxCaptchaTime
        );
        this.bots = {
            [this.bot.selfId]: Object.assign({}, opts, {
                id: this.bot.selfId,
                vk: this.bot.vk,
                send: this.bot.vk.api.messages.send.bind(this.bot.vk.api),
                call: this.bot.vk.api.call.bind(this.bot.vk.api),
                chats: {},
                pendingMessages: [],
                solvePromise: Promise.resolve(),
                ban: this.onlyAdditional,
            }),
        };
        let onInvite = (vk, info) => {
            if (info.invite !== vk.selfId) return;
            info.send('Привет! Я Лютая Подмена, помогаю Мие, пока она решает капчу!');
            vk.longpoll.stop();
        };
        return pf.allAsync(this.bot.additionalAccounts.map(vk => {
            let id = vk.selfId;
            if (!this.bot.clusterMode || this.bot.clusterMode.instanceNum === 0)
                vk.longpoll.on('chat.invite', (info) => onInvite(vk, info));
            if (id && id !== this.bot.selfId) {
                this.bots[id] = Object.assign({}, opts, {
                    id: id,
                    vk,
                    send: vk.api.messages.send.bind(vk.api),
                    call: vk.api.call.bind(vk.api),
                    chats: {},
                    pendingMessages: [],
                    solvePromise: Promise.resolve(),
                });
                if (!this.bot.admins.includes(id)) this.bot.admins.push(id);
            }
        })).then(() => pf.allAsync(Object.keys(this.bots).map(botId => {
            return this.bots[botId].vk.api.friends.areFriends({
                user_ids: Object.keys(this.bots).filter(id => id !== botId).join(',')
            }).then(users => {
                users = users.filter((user) => ![1,3].includes(user.friend_status));
                return pf.allAsync(users.map(({ user_id }) => this.bots[botId].vk.api.friends.add({user_id })))
            });
        })));
    }

    _findBotChatOld(chat, botId) {
        let bot = this.bots[botId];
        if (botId === this.bot.selfId || chat.type !== 'chat') return;
        return bot.vk.api.messages.searchDialogs({
            q: chat.title,
            limit: 100,
        }).then(request => {
            let chats = request.filter(c => c.title === chat.title && c.admin_id === chat.adminId);
            if (chats.length > 1)
                chats = chats.filter(c => {
                    if (chat.users.length !== c.users.length) return false;
                    for (let userId of chat.users) {
                        if (!c.users.includes(userId)) return false;
                    }
                });
            if (chats.length === 0) throw `cant find chat ${chat.id} to bot ${botId}`;
            bot.chats[chat.id] = chats[0].id + 2e9;
        })
    }

    _findBotChat(chat, botId) {
        let bot = this.bots[botId];
        if (botId === this.bot.selfId || chat.type !== 'chat') return;
        return AntiCaptchaBotChats.findOne({
            selfId: this.bot.selfId,
            botId,
            selfChatId: chat.id,
        }).exec().then(doc => {
            if (doc) {
                bot.chats[chat.id] = doc.botChatId;
                return;
            }
            let photo = null;
            let findIteration = (count = 200, offset = 0) => {
                return bot.vk.api.messages.getDialogs({ count, offset }).then(response => {
                    if (!response.items.length) {
                        setTimeout(() => {
                            if (!this.bot.chats[chat.id]) return;
                            return this._findBotChat(this.bot.chats[chat.id], botId);
                        }, this.findBotTimeout);
                        console.error(`cant find chat ${chat.id} to bot ${botId} (title ${chat.title}, ${chat.users.length} users, admin ${chat.adminId}, photo ${photo})`);
                        return;
                    }
                    let promises = [];
                    for (let { message } of response.items) {
                        if (!message.chat_id) continue;
                        if (message.photo_50 === photo
                            || (message.title === chat.title
                                && message.admin_id === chat.adminId)) {
                            promises.push(bot.vk.api.messages.getChatUsers({ chat_id: message.chat_id }).then(chatUsers => {
                                if (chat.users.filter(userId => !chatUsers.includes(userId)).length) return;
                                console.log('find chat', chat.id);
                                let botChatId = message.chat_id + 2e9;
                                bot.chats[chat.id] = botChatId;
                                return AntiCaptchaBotChats.findOneAndUpdate({
                                    selfId: this.bot.selfId,
                                    botId,
                                    selfChatId: chat.id,
                                }, {
                                    botChatId,
                                }, {
                                    upsert: true,
                                }).exec().then(() => {throw 'find chat'});
                            }))
                        }
                    }
                    return Promise.all(promises).then(() => findIteration(count, offset + count))
                });
            };
            return this.bot.vk.api.messages.getChat({
                chat_id: chat.id - 2e9,
            }).then(chatInfo => {
                if (chatInfo.photo_50) photo = chatInfo.photo_50;
                return findIteration();
            })
        })
    }

    _getBotChat(chatId, botId) {
        if (+botId === this.bot.selfId) return chatId;
        return this.bots[botId].chats[chatId];
    }

    _getChatBots(chatId) {
        if (!this.chatBots[chatId]) {
            this.chatBots[chatId] = [ this.bot.selfId ];
        }
        return this.chatBots[chatId];
    }

    _getAvailableBots(chatId, onlyFree = false, all = false, count = Infinity) {
        let bots = {};
        let solveBots = {};
        Object.keys(this.bots).slice(0, count).map(id => {
            if (this._getChatBots(chatId).includes(+id)
                && this._getBotChat(chatId, +id) && !this.bots[id].ban) {
                if (!this.bots[id].solve)
                    bots[id] = this.bots[id];
                else
                    solveBots[id] = this.bots[id];
            }
        });
        if (all) return Object.assign(solveBots, bots);
        if (Object.keys(bots).length || onlyFree) return bots;
        else return solveBots;
    }

    _getRandomAvailableBot(chatId, onlyFree = false, count) {
        let bots = this._getAvailableBots(chatId, onlyFree, undefined, count);
        if (!Object.keys(bots).length) return null;
        let botNums = Object.keys(bots);
        botNums.sort((a, b) => bots[a].countMessages - bots[b].countMessages);
        let botNum = botNums[0];
        return bots[botNum];
    }

    _addBotToChat(chat, botId, fromBots = this._getChatBots(chat.id)) {
        let chatId = chat.id;
        if (botId === this.bot.selfId || this.bots[botId].chats[chatId]) return Promise.resolve();
        return this.bot.ctrlEmit((chat, botId) => {
            if (!(botId in this.bots)) return Promise.resolve(null);
            // let timeout = setTimeout(() => this.bots[botId].vk.longpoll.stop(), 3e4);
            let result = Promise.resolve();
            // result = this.bots[botId].vk.longpoll.start();
            return result.then(() => {
                let result = Promise.reject();
                fromBots.reverse().map(id => {
                    result = result.catch(error => {
                        console.log('try to add bot', botId, 'to chat', chatId, 'from bot', id);
                        return this.bots[id].vk.api.messages.addChatUser({
                            chat_id: this._getBotChat(chatId, id) - 2e9,
                            user_id: botId,
                        });
                    });
                });
                return result.catch(error => {
                    console.log('cant add bot', botId, 'to chat', chatId);
                    return error;
                });
            }).then(error => {
                // clearTimeout(timeout);
                // return this.bots[botId].vk.longpoll.stop().then(() => error);
                return error;
            })
        }, 'addBotToChat', chat, botId);
    }

    _addAllBotsToChat() {
        const allChats = Object.keys(this.botsToAddToChat).map(id => +id);
        if (!allChats.length) return;
        const canInviteBots = Object.keys(this.bots).map(id => +id);
        console.log('start invite bots', allChats.length);
        const promises = [];
        const addBotToChat = (chat, botId, fromBots) => this.bot.ctrlEmit((chat, botId) => {
            let chatId = chat.id;
            if (!(botId in this.bots)) return Promise.resolve(null);
            let result = Promise.reject();
            fromBots.reverse().map(id => {
                result = result.catch(error => {
                    console.log('try to add bot', botId, 'to chat', chatId, 'from bot', id);
                    return this.bots[id].vk.api.messages.addChatUser({
                        chat_id: this._getBotChat(chatId, id) - 2e9,
                        user_id: botId,
                    }).catch(error => {
                        if (error && error.code === 9) canInviteBots.splice(canInviteBots.indexOf(id), 1);
                        throw error;
                    });
                });
            });
            return result.catch(error => {
                console.log('cant add bot', botId, 'to chat', chatId);
                return error;
            });
        }, 'addBotToChat', chat, botId);
        const addAllBotsToChat = (allChats, indexChat) => {
            let chatId = allChats[indexChat];
            let chat = this.bot.chats[chatId];
            let fromBots = this._getChatBots(chatId).filter(id => canInviteBots.includes(id));
            let result = Promise.resolve();
            if (fromBots.length && chat) result = pf.allSync(
                this.botsToAddToChat[chatId].map(botId => () => {
                    return addBotToChat(chat, botId, fromBots).then(error => {
                        if (error && error.code && error.code !== 15) return;
                        this.botsToAddToChat[chatId].splice(this.botsToAddToChat[chatId].indexOf(botId), 1);
                        if (!this.botsToAddToChat[chatId].length) delete this.botsToAddToChat[chatId];
                    })
                })
            );
            return result.then(() => {
                indexChat++;
                if (indexChat < allChats.length && canInviteBots.length) {
                    return addAllBotsToChat(allChats, indexChat);
                } else console.log('end invite bots in', indexChat, ' chats of', allChats.length);
            })
        };
        return addAllBotsToChat(allChats, 0);
    }

    _addBotToChatTimeout(chat, botId) {
        return AntiCaptchaBotChats.findOne({
            selfId: this.bot.selfId,
            botId,
            selfChatId: chat.id,
        }).then(doc => {
            if (doc) return;
            this.botsToAddToChat[chat.id] = this.botsToAddToChat[chat.id] || [];
            if (!this.botsToAddToChat[chat.id].includes(botId))
                this.botsToAddToChat[chat.id].push(botId);
        });
    }

    _init(bot) {
        this.addBotPendingCount = 0;
        process.on('message', packet => this._onProcessMessage(packet));
        this.botsToAddToChatInterval = setInterval(() => this._addAllBotsToChat(), 10*6e4);
        return super._init(bot).then(() => pf.allAsync([
            this.bot.Message.global.pre(this.bot.Message.eventNames.send, this._preMessage, this),
            this.bot.Message.global.pre(this.bot.Message.eventNames.sendPhoto, this._preSendPhoto, this),
            this.bot.Message.global.middlewarePre(this.bot.Message.eventNames.edit, this._middlewarePreEditMessage, this),
            this.bot.Message.global.middlewarePre(this.bot.Message.eventNames.delete, this._middlewarePreDeleteMessage, this),
            this.bot.Message.global.after(this.bot.Message.eventNames.send, this._afterMessage, this),
            this.bot.Chat.global.pre(this.bot.Chat.eventNames.addUser, this._onAddChatUser, this),
            this.bot.Chat.global.on(this.bot.Chat.eventNames.removeUser, this._onRemoveChatUser, this),
            pf.allAsync([CoreModuleEventController, ModuleEventController].map(module => {
                return module.global.middlewarePre(this.eventNames.runCommand, this._middlewarePreRunCommand, this);
            })),
            this._getVkBots().then(() => {
                Object.keys(this.bots).map(id => this.bots[id].vk.setCaptchaHandler((...args) => this.solveCaptcha(this.bots[id], ...args)));
                this.defaultSend = this.bot.vk.api.messages.send.bind(this.bot.vk.api);
                this.defaultCall = this.bot.vk.api.call.bind(this.bot.vk.api);
                this.bot.vk.api.messages.send = this._sendMessage.bind(this);
                this.bot.vk.api.call = this._call.bind(this);
            }),
        ]));
    }

    _final() {
        return super._final().then(() => pf.allAsync([
            this.bot.Message.global.removeListenersPreByHandler(this.bot.Message.eventNames.send, this),
            this.bot.Message.global.removeListenersPreByHandler(this.bot.Message.eventNames.sendPhoto, this),
            this.bot.Message.global.removeMiddlewarePreByHandler(this.bot.Message.eventNames.edit, this),
            this.bot.Message.global.removeMiddlewarePreByHandler(this.bot.Message.eventNames.delete, this),
            this.bot.Message.global.removeListenersAfterByHandler(this.bot.Message.eventNames.send, this),
            this.bot.Chat.global.removeListenersPreByHandler(this.bot.Chat.eventNames.addUser, this),
            this.bot.Chat.global.removeListenersOnByHandler(this.bot.Chat.eventNames.removeUser, this),
            pf.allAsync([CoreModuleEventController, ModuleEventController].map(module => {
                return module.global.removeMiddlewarePreByHandler(this.eventNames.runCommand, this);
            })),
        ]))
    }

    _initChat(chat) {
        return super._initChat(chat).then(() => {
            if (chat.type === 'chat')
                return pf.allAsync(Object.keys(this.bots).map(id => {
                    if (!this._getChatBots(chat.id).includes(+id)) this._addBotToChatTimeout(chat, +id);
                }));
        })
    }

    _preSendPhoto(source, params, message) {
        let errorMessage = `CAN'T SEND PHOTO: NO AVAILABLE BOTS (CHAT ${message.peer})`;
        let bot = this._getRandomAvailableBot(message.peer);
        if (!bot) {
            console.log(errorMessage);
            throw errorMessage;
        }
        params.antiCaptcha = {
            botId: bot.id,
            photo: true,
        };
        message.vk = bot.vk;
    }

    _preMessage(params, message) {
        let errorMessage = `CAN'T SEND MESSAGE: NO AVAILABLE BOTS (CHAT ${message.peer})`;
        let count = Infinity;
        if (params.antiCaptcha && params.antiCaptcha.done) {
            let bot = this.bots[params.antiCaptcha.botId] || this.bots[this.bot.selfId];
            return bot.solvePromise;
        }
        if (params.antiCaptcha && params.antiCaptcha.photo) {
            message.vk = this.bot.vk;
            return;
        }
        if (message.peer < 2e9 || params.attachment) {
            if (this.bots[this.bot.selfId].ban && !(params.antiCaptcha && params.antiCaptcha.selfDirect)) {
                console.log('attachment in message;', errorMessage);
                throw errorMessage;
            }
            return this.bots[this.bot.selfId].solvePromise;
        }
        if (params && params.chatSpamBan && params.chatSpamBan.link) {
            count = this.linkBotCount;
        }
        let bot = this._getRandomAvailableBot(message.peer, undefined, count);
        if (!bot) {
            if (params.antiCaptcha && params.antiCaptcha.selfDirect) {
                bot = this.bots[this.bot.selfId];
            } else {
                console.log(errorMessage);
                // throw errorMessage;
            }
        }
        params.antiCaptcha = Object.assign(params.antiCaptcha || {}, {
            botId: bot.id,
            peer: message.peer
        });
        // bot.pendingMessages.push(params);
        // setTimeout(() => bot.pendingMessages.includes(params) && bot.pendingMessages.splice(bot.pendingMessages.indexOf(params), 1), 3e4);
        // return bot.solvePromise;
    }

    _sendMessage(params) {
        let bot;
        if (!params.antiCaptcha || params.antiCaptcha.default) {
            bot = this.bots[this.bot.selfId];
        } else {
            if (params.antiCaptcha.skip) {
                console.log('SKIP MESSAGE TO CHAT', params.peer_id);
                return Promise.resolve(0);
            }
            bot = this.bots[params.antiCaptcha.botId];
            if (!bot && params.antiCaptcha.selfDirect) bot = this.bots[this.bot.selfId];
            if (!bot) {
                return Promise.resolve(0);
            }
            if (!params.antiCaptcha.done) {
                let chatId = this._getBotChat(params.peer_id, bot.id);
                if (!chatId) {
                    bot = this.bots[this.bot.selfId];
                }
                params.peer_id = chatId;
                // if (params.antiCaptcha.bot.id !== this.bot.selfId)
                delete params.forward_messages;
                params.antiCaptcha.done = true;
            }
        }
        if (bot.pendingMessages.includes(params)) {
            bot.pendingMessages.splice(bot.pendingMessages.indexOf(params), 1);
        }
        if (bot.solve) {
            return bot.solvePromise
                .then(() => this._sendMessage(params));
        }
        return bot.send(params);
    }

    _call(method, params = {}) {
        let bot;
        switch (method) {
            case 'messages.edit':
                if (params.antiCaptcha && params.antiCaptcha.botId) {
                    bot = this.bots[params.antiCaptcha.botId];
                    console.log(params);
                    let chatId = this._getBotChat(params.peer_id, params.antiCaptcha.botId);
                    console.log(chatId);
                    if (chatId) params.peer_id = chatId;
                } else bot = this.bots[this.bot.selfId];
                return bot.call(method, params);
                // if (params.antiCaptcha && params.antiCaptcha.mapResultId) {
                //     bot = params.antiCaptcha.mapResultId[params.message_id];
                //     if (!bot) return;
                //     return this.bot.call(method, params);
                // }
                // return this.defaultCall(method, params);

            case 'messages.delete':
                if (params.antiCaptcha && params.antiCaptcha.mapResultId) {
                    let bots = {};
                    params.message_ids.split(',').map(id => {
                        bot = params.antiCaptcha.mapResultId[id];
                        if (bot) {
                            bots[bot.id] = bots[bot.id] || [];
                            bots[bot.id].push(id);
                        }
                    });
                    delete params.antiCaptcha;
                    return Promise.all(Object.keys(bots).map(botId => {
                        let botParams = Object.assign({}, params, { message_ids: bots[botId].join(',') });
                        return this.bots[botId].call(method, botParams);
                    })).then(result => result[0]);
                }
                return this.defaultCall(method, params);

            default:
                return this.defaultCall(method, params);
        }
    }

    _afterMessage(params, message, result) {
        let bot = params.antiCaptcha && this.bots[params.antiCaptcha.botId] || this.bots[this.bot.selfId];
        bot.countMessages++;
        if (result && result.code === 9) {
            this._banBot(bot, this.floodControlTimeout);
            this._onCaptcha(bot);
            if (this.bot.clusterMode) {
                this.bot.clusterMode.send({
                    topic: 'antiCaptchaBanBot',
                    data: {
                        botId: bot.id,
                    },
                });
            }
            delete params.antiCaptcha;
            return message._send(params);
        } else if (result && ([5, 10, 14].includes(result.code))) {
            if (result.code === 14) console.log('CAPTCHA MOTHER FUCKER');
            if (result.code === 5) {
                clearTimeout(bot.unbanTimeout);
                bot.ban = true;
            }
            delete params.antiCaptcha;
            return message._send(params);
        } else if (typeof result === 'number') {
            message.antiCaptcha = message.antiCaptcha || {};
            message.antiCaptcha.mapResultId = message.antiCaptcha.mapResultId || {};
            message.antiCaptcha.mapResultId[result] = bot;
        }
    }

    _middlewarePreEditMessage([params], message) {
        if (message.antiCaptcha
            && message.antiCaptcha.mapResultId
            && message.antiCaptcha.mapResultId[params.message_id]) {
            params.antiCaptcha = {
                botId: message.antiCaptcha.mapResultId[params.message_id].id,
            };
        }
    }

    _middlewarePreDeleteMessage([params], message) {
        params.antiCaptcha = {
            mapResultId: message.antiCaptcha && message.antiCaptcha.mapResultId || {},
        };
    }

    _onCaptcha(fromBot) {
        // for (let params of fromBot.pendingMessages) {
        //     let bot = this._getRandomAvailableBot(params.peer_id, true);
        //     if (!bot) continue;
        //     let newParams = Object.assign({}, params);
        //     newParams.antiCaptcha = Object.assign({}, params.antiCaptcha);
        //     params.antiCaptcha.botId = newParams.antiCaptcha.botId = bot.id;
        //     params.peer_id = '';
        //     params.antiCaptcha.skip = true;
        //     console.log('redirect message from ', fromBot.id, ' to ', newParams.antiCaptcha.botId, ' in chat ', newParams.peer_id);
        //     this._sendMessage(newParams);
        // }
    }

    _onAddChatUser(userId, chat) {
        if (userId in this.bots) {
            let chatBots = this._getChatBots(chat.id);
            if (!chatBots.includes(userId)) {
                chatBots.push(userId);
            }
            return this._findBotChat(chat, userId)
                .then(() => {throw `user ${userId} is bot, don't add to chat ${chat.id}`})
        }
    }

    _onRemoveChatUser(userId, chat) {
        let chatBots = this._getChatBots(chat.id);
        if (userId in this.bots) {
            if (chatBots.includes(userId))
                chatBots.splice(chatBots.indexOf(userId), 1);
        }
        // if (userId === this.bot.selfId) {
        //     if (this.bot.clusterMode && this.bot.clusterMode.instanceNum !== 0) return;
        //     return pf.allAsync(chatBots.map(id => {
        //         if (id === this.bot.selfId || !this._getBotChat(chat.id, id)) return;
        //         console.log('kick self', id, 'from chat', chat.id, 'map chat', this._getBotChat(chat.id, id));
        //         return this.bots[id].vk.api.messages.removeChatUser({
        //             chat_id: this._getBotChat(chat.id, id) - 2e9,
        //             user_id: id,
        //         }).catch(console.error);
        //     }))
        // }
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
        if (!(packet instanceof Object) || !packet.topic || !packet.data.botId) return;
        let bot = this.bots[packet.data.botId];
        if (!bot) return;
        if (packet.topic === 'antiCaptchaSolve' && this.bot.clusterMode.instanceNum !== 0) {
            console.log(`Get captcha key! (bot ${bot.id})`);
            this._afterSolve(bot, packet.data.key);
        }
        if (packet.topic === 'antiCaptchaStartSolve' && this.bot.clusterMode.instanceNum === 0) {
            if (!bot.solve)
                this.solveCaptcha(bot, packet.data.src, packet.data.sid, null, packet.data.method, packet.data.params);
        }
        if (packet.topic === 'antiCaptchaBanBot') {
            this._banBot(bot, this.floodControlTimeout);
        }
    }

    _afterSolve(bot, key = null) {
        bot.solve = false;
        let solveResolve = bot.solveResolve;
        let captchaRetry = bot.captchaRetry;
        bot.solveResolve = null;
        bot.captchaRetry = null;
        let retryTimes = 0;
        let maxRetryTimes = 4;
        if (captchaRetry instanceof Function) {
            let catchError = error => {
                if (error instanceof Error && error.code === 14) {
                    if (retryTimes++ >= maxRetryTimes) return;
                    setTimeout(() => bot.solvePromise.then(() => captchaRetry().catch(catchError)), 5e2)
                }
            };
            captchaRetry(key).catch(catchError);
        }
        if (solveResolve instanceof Function) {
            setTimeout(() =>  solveResolve(), 5e2);
        }
        clearTimeout(bot.retryTimeout);
    }

    _banBot(bot, min = 5) {
        if (bot.ban) return;
        clearTimeout(bot.unbanTimeout);
        bot.ban = true;
        console.log('ban bot', bot.id, 'for', min, 'minutes');
        bot.unbanTimeout = setTimeout(() => {
            bot.ban = false;
            console.log('unban bot', bot.id);
        }, min * 6e4);
    }

    solveCaptcha(bot, src, sid, retry = null, method, params) {
        if (++bot.captchaLastMinute >= this.maxCaptchaFromTime) {
            this._banBot(bot, 2);
        }
        console.log('captcha', method);
        // if (method === 'messages.send' && retry) {
        //     if (params.antiCaptcha) {
        //         params.peer_id = params.antiCaptcha.peer || params.peer_id;
        //         delete params.antiCaptcha.done;
        //     }
        //     let message = new this.bot.Message();
        //     message.peer = params.peer_id;
        //     retry = null;
        //     console.log('retry message', params);
        //     this._preMessage(params, message).then(() => this._sendMessage(params));
        // }
        let setRetry = () => new Promise(resolve => {
            setTimeout(() => resolve(bot.solvePromise.then(() => {
                if (bot.solve) return setRetry();
                retry && retry().catch(error => console.error('other captcha', error));
            })), 1e3);
        });
        if (bot.solve) return retry ? setRetry() : null;
        bot.solve = Date.now();
        bot.countMessages *= 1.5;
        if (this.bot.clusterMode && this.bot.clusterMode.instanceNum !== 0) {
            if (!bot.solveResolve) {
                console.log(`Wait solve captcha... (bot ${bot.id})`);
                bot.captchaRetry = retry;
                bot.solvePromise = new Promise(resolve => bot.solveResolve = resolve);
                bot.retryTimeout = setTimeout(() => this._afterSolve(bot), 3e4);
                this.bot.clusterMode.send({
                    topic: 'antiCaptchaStartSolve',
                    data: {
                        botId: bot.id,
                        src,
                        sid,
                        method,
                        params
                    },
                });
                // this._onCaptcha(bot);
            }
            return bot.solvePromise;
        }
        let retryKey;
        // this.bot.setPause(true);
        console.log(`Start solve captcha... (bot ${bot.id})`);
        let image;
        let antiCaptcha = this.antiCaptcha;
        bot.solvePromise = pf.cbp(request.get.bind(request), src)
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
                console.log(`Captcha solved!  (bot ${bot.id})`);
                this._afterSolve(bot);
                if (this.bot.clusterMode && this.bot.clusterMode.instanceNum === 0) {
                    this.bot.clusterMode.send({
                        topic: 'antiCaptchaSolve',
                        data: {
                            botId: bot.id,
                            key: retryKey,
                        },
                    });
                }
                // return this.bot.setPause(false);
            })
            .catch((error) => {
                console.error(`Captcha error:  (bot ${bot.id})`, error);
                this._banBot(bot, 2);
                bot.solve = false;
                if (this.bot.clusterMode && this.bot.clusterMode.instanceNum === 0) {
                    this.bot.clusterMode.send({
                        topic: 'antiCaptchaSolve',
                        data: {
                            botId: bot.id,
                            key: retryKey,
                        },
                    });
                }
                if (error instanceof Error && error.code === 14 && retry) {
                    let catchError = error => {
                        if (error instanceof Error && error.code === 14) {
                            setTimeout(() => bot.solvePromise.then(() => retry().catch(catchError)), 5e2)
                        }
                    };
                    retry(key).catch(catchError);
                }
                // return this.bot.setPause(false);
            });
        this._onCaptcha(bot);
        return bot.solvePromise;
    }

};
