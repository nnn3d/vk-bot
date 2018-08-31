'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const ChatInviteBans = require('./ChatInviteBans');
const ChatInviteDayStat = require('./ChatInviteDayStat');

module.exports = class ChatInviteBan extends ModuleEventController {

    /**
     *
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            commandList: {
                name: 'Бан чатов',
            },
            vip: {
                free: 'chat',
            },
            commands: [
                {
                    name: 'unBan',
                    check: {
                        args: /^разбан (\d+)/i,
                        admin: true,
                        type: 'dm',
                    },
                    commandList: {
                        name: 'разбан',
                        usage: 'разбан (номер чата)',
                    },
                    messageTemplate: {
                        title: 'чат #{0} теперь разбанен!',
                    }
                },
                {
                    name: 'ban',
                    check: {
                        args: /^бан (\d+)/i,
                        admin: true,
                        type: 'dm',
                    },
                    commandList: {
                        name: 'бан',
                        usage: 'бан (номер чата)',
                    },
                    messageTemplate: {
                        title: 'чат #{0} теперь забанен!',
                    }
                },
                {
                    name: 'showBan',
                    check: {
                        args: /^баны$/i,
                        admin: true,
                    },
                    commandList: {
                        name: 'баны',
                    },
                    messageTemplate: {
                        title: 'Забаненые чаты:',
                        body: '#{0} (#{1})',
                        emptyFail: 'Нет забаненых чатов',
                    }
                },
                {
                    name: 'returnToChat',
                    check: {
                        args: /^возврат (\d+)/i,
                        type: 'dm',
                    },
                    vip: {
                        usages: 3,
                    },
                    antiCaptcha: {
                        selfDirect: true,
                    },
                    commandList: {
                        name: 'возврат в чат',
                        usage: 'возврат (номер чата)',
                        description: 'возвращает бота в ваш чат, если он сам вышел',
                    },
                    messageTemplate: {
                        title: 'бот успешно возвращен в чат № #{0}',
                        fail: 'не удалось вернуть бота в чат в чат № #{0}',
                    },
                },
                {
                    name: 'addToChat',
                    check: {
                        args: /^(?:инвайт (.+)|(https:\/\/vk\.me\/join.+))$/i,
                        type: 'dm',
                    },
                    vip: {
                        usages: 3,
                    },
                    antiCaptcha: {
                        selfDirect: true,
                    },
                    commandList: {
                        hidden: true,
                        name: 'инвайт бота в чат',
                        usage: 'инвайт (ссылка на инвайт в чат)',
                        description: 'добавляет бота в ваш чат',
                    },
                    messageTemplate: {
                        title: 'бот успешно добавлен в чат № #{0}',
                        fail: 'не удалось вернуть бота в чат',
                        failUsers: 'в чате должно быть больше #{0} участников',
                        failLink: 'неправильная ссылка на инвайт',
                        failInvite: 'меня исключили из этой беседы, и я не могу вернуться!',
                    },
                },
            ],
        }
    }

    _init(bot) {
        this.minChatUsersToInvite = 25;
        this.symbolsDayLimit = 100000;
        this.messagesDayLimit = 5000;
        this.chatsInfo = {};
        this.smallChats = {};
        this.chatOutPromises = {};
        this.intervalUpdateChatsInfo = setInterval(() => this._updateAllChatInfo(), 10 * 6e4);
        if (!bot.clusterMode || bot.clusterMode.instanceNum === 0) {
            this.intervalCheckChatsInfo = setInterval(() => this._checkChatInfo(), 20 * 6e4);
            this._checkChatInfo();
        }
        return super._init(bot).then(() => promiseFactory.allAsync([
            this.bot.Chat.global.pre(this.bot.Chat.eventNames.init, this._onChatInit, this),
            this.bot.Chat.global.after(this.bot.Chat.eventNames.message, this._onChatMessage, this),
            this.bot.after(this.bot.eventNames.createChat, this._afterChatInit, this),
            // this.bot.pre(this.bot.eventNames['chat.invite'], this._onInvite, this),
            this.bot.pre('autoInviteBotToChat', this._onAutoInviteBotToChat, this),
            this.bot.on(this.bot.eventNames['chat.kick'], this._onKick, this),
        ]))
    }

    _final() {
        return super._final().then(() =>  promiseFactory.allAsync([
            this.bot.Chat.global.removeListenersPreByHandler(this.bot.Chat.eventNames.init, this),
            this.bot.Chat.global.removeListenersAfterByHandler(this.bot.Chat.eventNames.message, this),
            this.bot.removeListenersAfterByHandler(this.bot.eventNames.createChat, this),
            // this.bot.removeListenersPreByHandler(this.bot.eventNames['chat.invite'], this),
            this.bot.removeListenersPreByHandler('autoInviteBotToChat', this),
            this.bot.removeListenersOnByHandler(this.bot.eventNames['chat.kick'], this),
        ]))
    }

    stop() {
        return this._updateAllChatInfo();
    }

    _addChatWithDelay(chatId) {
        setTimeout(() => {
            ChatInviteBans.findOneAndUpdate({ chatId }, { chatId }, { upsert: true, setDefaultsOnInsert: true});
        }, 6e4);
    }

    _onAutoInviteBotToChat(chatId, users) {
        return ChatInviteBans.findOne({ chatId }).exec()
            .then(doc => {
                if (doc && doc.ban || users.length < this.minChatUsersToInvite) throw `chat ${chatId} is banned, don't need to invite`;
                // else console.log('add bot to chat', chatId);
            });
    }

    _outFromChat(chatId, message) {
        return this.bot.ctrlEmit(() => {
            console.log(`out from chat ${chatId}`);
            let result = Promise.resolve();
            // if (message) {
            //     result = new this.bot.Message({peer: chatId}).setTitle(message).send({
            //         antiCaptcha: { selfDirect: true },
            //     })
            //         .catch(console.error)
            //         .then(() => new Promise(resolve => setTimeout(resolve, 3e3)))
            // }
            return result
                // .then(() => this.bot.vk.api.messages.removeChatUser({
                //     chat_id: chatId - 2e9,
                //     member_id: this.bot.selfId,
                //     v: '5.81'
                // }))
                // .then(() => new Promise(resolve => setTimeout(resolve, 3e3)))
                // .then(() => this.bot.removeChat(chatId))
                .then(() => true)
                // .catch(error => {
                //     if (error.code === 15) return;
                //     throw error;
                // });
        }, 'VkRemoveChatUser', chatId, this.bot.selfId);
    }

    _outFromChatWithError(chatId, message) {
        return this._outFromChat(chatId, message).then(result => {
            if (result !== null) throw `chat ${chatId} is permanently banned`;
            return null;
        });
    }

    _updateStatus(chatId, set) {
        return ChatInviteBans.findOneAndUpdate({ chatId }, set, { upsert: true }).exec();
    }

    _updateAllChatInfo() {
        console.log('start save invite day stat to DB');
        let opsCIDS = [];
        let result = Promise.resolve();
        let date = new Date();
        date.setHours(0, 0 ,0, 0);
        for (let chatId of Object.keys(this.chatsInfo)) {
            let chatInfo = this.chatsInfo[chatId];
            delete this.chatsInfo[chatId];
            opsCIDS.push({
                updateOne: {
                    filter: { chatId, date },
                    update: {
                        $inc: chatInfo,
                    },
                    upsert: true,
                }
            });
        }
        if (opsCIDS.length) result = result
            .then(() => ChatInviteDayStat.bulkWrite(opsCIDS))
            .then(() => console.log('end save invite day stat to DB'));
        return result;
    }

    _checkChatInfo() {
        return ChatInviteDayStat.find({
            $or: [
                { symbols: { $gt: this.symbolsDayLimit } },
                { messages: { $gt: this.messagesDayLimit } },
            ]
        }).then(docs => {
            if (!docs.length) return;
            docs.forEach(doc => {
                let message = `к сожалению, этот чат превысил ограничение по активу (номер чата "${doc.chatId}")`;
                this._outFromChat(doc.chatId, message)
                    .then(result => {
                        if (result !== null) {
                            console.log(`chat ${doc.chatId} exceed day limit`);
                            this._addBan(+doc.chatId).then(() => console.log(`chat ${doc.chatId} ban`));
                        } else {
                            console.log('out from chat error');
                        }
                        doc.remove();
                    })
                }
            );
        })
    }

    _addBan(chatId) {
        return this._updateStatus(chatId, { ban: true, canInvite: false });
    }

    _addChatInfo(chatId, symbols, messages) {
        if (!this.chatsInfo[chatId])
            this.chatsInfo[chatId] = {
                symbols: 0,
                messages: 0,
            };
        this.chatsInfo[chatId].symbols += symbols;
        this.chatsInfo[chatId].messages += messages;
    }

    _onChatInit(chat) {
        let message = `вы превысили ограничение по активу для обычных конференций, оно может быть снято получением ВИП-статуса (номер чата ${chat.id})`;
        return ChatInviteBans.findOne({ chatId: chat.id }).exec()
            .then(doc => {
                if (doc && doc.ban) return this._outFromChatWithError(chat.id, message);
            });
    }

    _afterChatInit(chat) {
        if (chat.type !== 'chat') return;
        if (chat.users.length && chat.users.length < this.minChatUsersToInvite && !this.bot.admins.includes(chat.adminId)) {
            console.log(`less than ${this.minChatUsersToInvite} users (${chat.users.length}) in chat ${chat.id}`);
            let message = `в чате должно быть не меньше ${this.minChatUsersToInvite} участников, для снятия ограничений получите ВИП-статус! (номер чата "${chat.id}")`;
            this.smallChats[chat.id] = true;
            return this._outFromChat(chat.id, message)
                .then(result => {
                    if (result !== null) {
                        // return this.bot.removeChat(chat.id);
                    }
                });
        }
        else return this._updateStatus(chat.id, { chatId: chat.id });
    }

    _onChatMessage(message, chat) {
        if (this.bot.admins.includes(message.user) || chat.type !== 'chat') return;
        let symbols = message.text.length;
        this._addChatInfo(chat.id, symbols, 1);
    }

    _onInvite(info) {
        if (info.invite !== this.bot.selfId) return;
        let chatId = info.chat + 2e9 || info.peer;
        if (this.bot.clusterMode && this.bot.clusterMode.isClusterChat(chatId)) {
            return;
        }
        this.chatOutPromises[chatId] = Promise.resolve();
        let message = `ваш чат находится в бане по причине превышения актива (номер чата ${chatId})`;
        return ChatInviteBans.findOne({ chatId }).exec()
            .then(doc => {
                if (!doc) return;
                let result = Promise.resolve();
                if (doc.ban) {
                    // if (!doc.ban) result = this._addBan(chatId);
                    return result.then(() => this._outFromChatWithError(chatId, message));
                } else if (doc.canInvite) {
                    return this._updateStatus(chatId, { canInvite: false });
                }
            })
    }

    _onKick(info) {
        if (info.kick !== this.bot.selfId || info.user === this.bot.selfId) return;
        let chatId = info.chat + 2e9 || info.peer;
        // if (this.smallChats[chatId]) {
        //     delete this.smallChats[chatId];
        //     return;
        // }
        return Promise.resolve();
        // return this._addBan(chatId);
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    returnToChat(chat, message, command) {
        let info = command.check.args.exec(message.getCommandText());
        let chatId = info[1];
        if (chatId < 2e9) chatId += 2e9;
        return this.bot.vk.api.messages.addChatUser({
            user_id: this.bot.selfId,
            chat_id: chatId - 2e9,
        })
            .then(result => message.setTitleTemplate(command.messageTemplate.title, chatId).send())
            .catch(error => message.setTitleTemplate(command.messageTemplate.fail, chatId).send());
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    addToChat(chat, message, command) {
        let [, link1, link2] = command.check.args.exec(message.getCommandText());
        let link = link1 || link2;
        console.log('link', link);
        return this.bot.vk.api.call('messages.getChatPreview', { link })
            .then(({ preview }) => {
                let result;
                if (preview.members.length < this.minChatUsersToInvite && false) {
                    return message
                        .setTitleTemplate(command.messageTemplate.failUsers, this.minChatUsersToInvite)
                        .send()
                        .then(() => null);
                }
                if (preview.local_id) result = this.bot.vk.api.messages.addChatUser({
                    chat_id: preview.local_id,
                    user_id: this.bot.selfId,
                })
                    .catch(() => {})
                    .then(() => preview.local_id + 2e9);
                else result = this.bot.vk.api.call('messages.joinChatByInviteLink', { link })
                    .then(({ chat_id }) => chat_id + 2e9);
                return result
                    .then(chatId => {
                        if (!chatId) return;
                        return promiseFactory.allAsync(
                            this.bot.additionalAccounts.map(vk => {
                                return this.bot.ctrlEmit(() => {
                                    return vk.api.call('messages.joinChatByInviteLink', {link});
                                }, 'addBotToChat', new this.bot.Chat(chatId), vk.selfId);
                            })
                        ).then(() => message.setTitleTemplate(command.messageTemplate.title, chatId).send())
                    })
                    .catch(error => {
                        console.error(error);
                        return message.setTitleTemplate(command.messageTemplate.fail).send();
                    })
            }).catch(error => {
                let template = error.code === 917
                    ? command.messageTemplate.failInvite
                    : command.messageTemplate.failLink;
                return message.setTitleTemplate(template).send();
            })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    unBan(chat, message, command) {
        let chatId = message.getCommandArgs()[1];
        message.setTitleTemplate(command.messageTemplate.title, chatId);
        return this._updateStatus(chatId, { ban: false, canInvite: true })
            .then(() => message.send());
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    ban(chat, message, command) {
        let chatId = +message.getCommandArgs()[1];
        message.setTitleTemplate(command.messageTemplate.title, chatId);
        return this._addBan(chatId)
            .then(() => message.send());
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showBan(chat, message, command) {
        let chatId = message.getCommandArgs()[1];
        return ChatInviteBans.find({ ban: true }).sort('-date').exec()
            .then(docs => {
                if (!docs.length) return message.setTitle(command.messageTemplate.emptyFail).send();
                return message.setTitle(command.messageTemplate.title)
                    .setBodyTemplate(command.messageTemplate.body, n => docs[n].chatId, n => docs[n].date)
                    .setTemplateLength(Math.min(docs.length, 10))
                    .send();
            });
    }

};
