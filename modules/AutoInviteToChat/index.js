'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const AutoInviteChats = require('./AutoInviteChats');

module.exports = class AutoInviteToChat extends ModuleEventController {

    constructor() {
        super();
        this.countAccounts = 3;
    }

    _init(bot) {
        this.bot = bot;
        if (this.bot.clusterMode && this.bot.clusterMode.instanceNum !== 0) return;
        this.listeners = new Map;
        let promises = [];
        this.checkDialogsInterval = setInterval(() => this._checkDialogs(), 6e5);
        this.bot.additionalAccounts.slice(0, this.countAccounts).map(vk => {
            // promises.push(this.bot.on(this.bot.eventNames['chat.kick'], info => this._onKick(info, vk), this));
        });
        return promiseFactory.allAsync(promises).then(() => this._checkDialogs());
    }

    _final() {
        clearInterval(this.checkDialogsInterval);
        return this.bot.removeListenersOnByHandler(this.bot.eventNames['chat.kick'], this);
    }

    _checkDialogs() {
        console.log('start check dialogs to invite self');
        this.bot.additionalAccounts.slice(0, this.countAccounts).map(vk => {
            let result = Promise.resolve();
            let offsetError = -1;
            let next = (count = 200, offset = 0) => {
                let chatIds = [];
                return vk.api.messages.getDialogs({ count, offset })
                    .then(response => {
                        let chats = response.items;
                        if (!chats.length) return;
                        chats.forEach(({ message }) => {
                            if (!message.chat_id) return;
                            chatIds.push(message);
                        });
                        if (!chatIds.length) return next(count, offset + count);
                        return vk.api.messages.getChatUsers({ chat_ids: chatIds.map(c => c.chat_id).join(',') }).then(chats => {
                            chatIds.map(message => {
                                if (!chats[message.chat_id] || !chats[message.chat_id].length
                                    || chats[message.chat_id].includes(this.bot.selfId)
                                    || chats[message.chat_id].length > 245) return;
                                result = result.then(() => {
                                    return AutoInviteChats.findOne({ chatId: message.chat_id, botId: vk.selfId }).exec()
                                }).then(doc => {
                                    if (doc) {
                                        return Promise.resolve();
                                        // return vk.api.messages.removeChatUser({
                                        //     chat_id: message.chat_id,
                                        //     user_id: vk.selfId,
                                        // }).catch(() => {});
                                    }
                                    console.log('auto invite self to chat', message.chat_id, 'from bot', vk.selfId);
                                    return this.bot.ctrlEmit(
                                        () => vk.api.messages.addChatUser({
                                            chat_id: message.chat_id,
                                            user_id: this.bot.selfId,
                                        }),
                                        'autoInviteBotToChat',
                                        message.chat_id + 2e9,
                                        vk.selfId,
                                        message.chat_active
                                    )
                                        .catch(error => error)
                                        .then(res => {
                                            if (res instanceof Error && res.code !== 15) {
                                                if (res.code === 9) throw 'flood control';
                                            } else {
                                                let date = res && res.code === 15 ? new Date(1e14) : new Date();
                                                return new AutoInviteChats({
                                                    chatId: message.chat_id,
                                                    botId: vk.selfId,
                                                    date,
                                                }).save();
                                            }
                                        })
                                });
                            });
                            return result.catch(() => {}).then(() => next(count, offset + count));
                        }).catch(() => next(count, offset + count));
                    }, error => {
                        if (offset !== offsetError) {
                            offsetError = offset;
                            return next(count, offset);
                        } else {
                            return next(count, offset + count);
                        }
                    });
            };
            return next().then(() => console.log('all dialogs checked! bot', vk.selfId))
                .catch(err => console.log('error when checks dialogs! bot', vk.selfId, err));
        })
    }

    _onInvite(vk, info, id) {
        if (info.invite !== id) return;
        return vk.api.messages.getChatUsers({ chat_id: info.chat }).then(users => {
            if (!users.includes(this.bot.selfId)) return vk.api.messages.addChatUser({
                chat_id: info.chat,
                user_id: this.bot.selfId
            });
        }).catch(() => console.error);
    }


    _onKick(info, vk) {
        if (info.kick !== this.bot.selfId) return;
        console.log('kick self', vk.selfId, 'from', info.chat);
        return vk.api.messages.removeChatUser({
            chat_id: info.chat,
            member_id: vk.selfId,
            v: '5.81'
        }).catch(() => {});
    }

};
