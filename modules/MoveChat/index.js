'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const pf = promiseFactory;
const MongoClient = require('mongodb').MongoClient;

module.exports = class MoveChat extends ModuleEventController {

    constructor({ token } = {}) {
        super();
        this.token = token;
        this.moveChats = {};
    }

    /**
     *
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            commandList: {
                name: 'Перенос чата',
                description: 'Переносит данные чатов',
            },
            commands: [
                {
                    name: 'moveChat',
                    check: {
                        args: /^переезд (http.+)$/i,
                        type: 'chat',
                    },
                    commandList: {
                        name: 'переезд (ссылка на инвайт)',
                        description: 'переносит данные в новый чат',
                        hidden: (chat) => chat.adminId !== 471756819
                    },
                    vip: {
                        paid: true
                    },
                    commandAccess: {
                        defaultStatus: 10,
                    },
                    messageTemplate: {
                        title: 'чат успешно перенесен!',
                        failFriend: 'подайте заявку [id#{0}|этому аккаунту] в друзья, после чего вызовите эту команду снова (не надо ждать пока вас примут в друзья)',
                        fail: 'что-то пошло не так, попробуйте добавить ботов в новую беседу вручную, после чего повторите эту команду',
                        titleStart: 'начинаем переносить данные из чата №#{0} в чат №#{1} (может занять продолжительное время, не выполняйте команды бота и ничего не пишите в обоих чатах во время переноса во избежание ошибок)...',
                        failChat: 'не удалось создать чат, превышено ограничение на создание чатов в час, попробуйте снова позднее',
                        failLink: 'неправильная ссылка на инвайт',
                        failInvite: 'меня исключили из этой беседы, и я не могу войти!',
                    }
                },
                {
                    name: 'reloadChat',
                    check: {
                        args: /^перезапуск чата (\d+)$/,
                        admin: true,
                    },
                    commandList: {
                        name: 'создать чат',
                        usage: 'создать чат (номер старого чата) (id пользователя)',
                        description: 'создает чат с ботом админом и переносит данные из старого, делая админом пользователя в новом чате',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'чат #{0} успешно перезагружен',
                    }
                },
                {
                    name: 'createChat',
                    check: {
                        args: /^создать чат (\d+) (\d+)$/i,
                        admin: true,
                    },
                    commandList: {
                        name: 'создать чат',
                        usage: 'создать чат (номер старого чата) (id пользователя)',
                        description: 'создает чат с ботом админом и переносит данные из старого, делая админом пользователя в новом чате',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'чат успешно создан!',
                        failFriend: '[id#{0}|этот пользователь] должен добавить [id#{1}|этот аккаунт] в друзья, после чего вызовите эту команду снова',
                        fail: 'что-то пошло не так, обратитесь к администратору',
                        titleStart: 'начинаем переносить данные из чата №#{0} в чат №#{1} (может занять продолжительное время, не выполняйте команды бота в обоих чатах во время переноса во избежание ошибок)...',
                    }
                },
                {
                    name: 'moveInfo',
                    check: {
                        args: /^перенести данные (\d+) (\d+)$/i,
                        admin: true,
                    },
                    commandList: {
                        name: 'перенос данных',
                        usage: 'перенести данные (номер старого чата) (номер нового чата)',
                        description: 'переносит данные из старого чата в новый',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'данные успешно перенесены!',
                        fail: 'что-то пошло не так, обратитесь к администратору',
                        titleStart: 'начинаем переносить данные из чата №#{0} в чат №#{1} (может занять продолжительное время, не выполняйте команды бота в обоих чатах во время переноса во избежание ошибок)...',
                    }
                },
                {
                    name: 'deleteInfo',
                    check: {
                        args: /^удалить данные (\d+)$/i,
                        admin: true,
                    },
                    commandList: {
                        name: 'удаление данных',
                        usage: 'удалить данные (номер чата)',
                        description: 'удаляет данные из старого чата в новый',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'данные успешно удалены!',
                        fail: 'что-то пошло не так, обратитесь к администратору',
                        titleStart: 'начинаем удалять данные из чата №#{0}',
                    }
                },
                {
                    name: 'transferInfo',
                    check: {
                        args: /^перенос( новый)? (\d+) (\d+)$/i,
                        admin: true,
                    },
                    commandList: {
                        name: 'перенос данных',
                        usage: 'перенос (номер старого чата) (номер нового чата)',
                        description: 'переносит данные из старого чата в новый',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'данные успешно перенесены!',
                        fail: 'что-то пошло не так, обратитесь к администратору',
                        titleStart: 'начинаем переносить данные из чата №#{0} в чат №#{1} (может занять продолжительное время, не выполняйте команды бота в обоих чатах во время переноса во избежание ошибок)...',
                    }
                },
                {
                    name: 'transferChat',
                    check: {
                        args: /^перенос чата( новый)? (\d+) (\d+)$/i,
                        admin: true,
                    },
                    commandList: {
                        name: 'перенос чата',
                        usage: 'перенос чата (номер старого чата) (id пользователя)',
                        description: 'создает чат с ботом админом и переносит данные из старого, делая админом пользователя в новом чате',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'чат успешно создан!',
                        failFriend: '[id#{0}|этот пользователь] должен добавить [id#{1}|этот аккаунт] в друзья, после чего вызовите эту команду снова',
                        fail: 'что-то пошло не так, обратитесь к администратору',
                        titleStart: 'начинаем переносить данные из старого чата №#{0} в чат №#{1} (может занять продолжительное время, не выполняйте команды бота в обоих чатах во время переноса во избежание ошибок)...',
                    }
                },
                {
                    name: 'showStatuses',
                    check: {
                        args: /^чек статусы?( старый)? (\d+)$/i,
                        admin: true,
                    },
                    commandList: {
                        name: 'чек статус',
                        usage: 'чек статус (номер чата)',
                        description: 'показывает высшие статусы чата',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'статусы чата #{0}',
                        body: '#{0} - #{1}',
                    }

                },
                // {
                //     name: 'addToChat',
                //     check: {
                //         args: /^инвайт (.+)$/i,
                //         admin: true,
                //     },
                //     commandList: {
                //         hidden: true,
                //         name: 'инвайт бота в чат',
                //         usage: 'инвайт (ссылка на инвайт в чат)',
                //         description: 'добавляет бота в ваш чат',
                //     },
                //     messageTemplate: {
                //         title: 'бот успешно добавлен в чат № #{0}',
                //         fail: 'не удалось вернуть бота в чат в чат',
                //         failUsers: 'в чате должно быть больше #{0} участников',
                //         failLink: 'неправильная ссылка на инвайт',
                //     },
                // },
            ]
        }
    }

    _init(bot) {
        this.oldBot = 486809653;
        this.findBotTimeout = 6e4;
        return super._init(bot).then(() => {
            this.webChat = new this.bot.Chat(0);
            this.webChat.title = 'Новый чат';
            if (!this.token) {
                this.vk = this.bot.vk;
                this.adminId = this.bot.selfId;
                return;
            }
            let config = this.token instanceof Object ? this.token : { token: this.token };
            this.vk = this.bot.createVk(Object.assign({}, this.bot.config.vk, config));
            return pf.allAsync([
                this.bot.middlewareOn('Web.getChatList', this._webGetChatList, this),
                this.bot.on('MoveChat.add', this._moveChat, this),
                this.vk.api.users.get()
                    .then((info) => {
                        if (!info[0] || !info[0].id) {
                            return this.final().then(() => {throw new Error(`no self id for MoveChat module`)});
                        }
                        this.adminId = info[0].id;
                        if (this.adminId === this.bot.selfId) {
                            this.vk = this.bot.vk;
                            return;
                        }
                        if (!this.bot.admins.includes(this.adminId)) this.bot.admins.push(this.adminId);
                        return this.bot.Chat.global.pre(this.bot.Chat.eventNames.addUser, userId => {
                            if (userId === this.adminId) throw `don't add admin to chat users`;
                        }, this);
                    })
            ])
        });
    }

    _final() {
        return super._final().then(pf.allAsync([
            this.bot.removeMiddlewareOnByHandler('Web.getChatList', this),
            this.bot.removeListenersOnByHandler('MoveChat.add', this),
        ]))
    }

    _findChat(title, count = 200, offset = 0) {
        return this.bot.vk.api.messages.getDialogs({ count, offset }).then(response => {
            if (!response.items.length) throw `can't find new chatId (module 'MoveChat')`;
            for (let { message } of response.items) {
                if (message.title === title) {
                    return message.chat_id + 2e9;
                }
            }
            return this._findChat(title, count, offset + count);
        });
    }

    _webGetChatList([userId, chatList]) {
        return [userId, chatList];
    }

    _moveInfo(fromChatId, toChatId) {
        let client, db, collections;
        return pf.dcbp(fn => MongoClient.connect('mongodb://localhost:27017', fn))
            .then(result => {
                client = result;
                db = client.db('bot'+this.bot.selfId);
                return pf.dcbp(fn => db.listCollections().toArray(fn))
            })
            .then(result => {
                collections = result.map(doc => doc.name).filter(name => name !== 'system.indexes');
                return pf.allSync(collections.map(name => () => {
                    return pf.dcbp(fn => db.collection(name).updateMany({ chatId: fromChatId }, { $set: { chatId: toChatId } }, fn))
                        .then(result => console.log('move info in collection', name, 'from chat', fromChatId, 'to chat', toChatId, 'count', result.result.n));
                }))
            })
            .then(() => {
                client.close();
            });
    }

    _deleteInfo(chatId) {
        let client, db, collections;
        return pf.dcbp(fn => MongoClient.connect('mongodb://localhost:27017', fn))
            .then(result => {
                client = result;
                db = client.db('bot'+this.bot.selfId);
                return pf.dcbp(fn => db.listCollections().toArray(fn))
            })
            .then(result => {
                collections = result.map(doc => doc.name).filter(name => name !== 'system.indexes');
                return pf.allSync(collections.map(name => () => {
                    return pf.dcbp(fn => db.collection(name).remove({ chatId: chatId }, fn))
                        .then(result => console.log('move info in collection', name, 'from chat', chatId, 'count', result.result.n));
                }))
            })
            .then(() => {
                client.close();
            });
    }

    _transferInfoFrom(fromChatId, toChatId, oldBotId) {
        let client, db, oldDb, collections;
        return pf.dcbp(fn => MongoClient.connect('mongodb://localhost:27017', fn))
            .then(result => {
                client = result;
                db = client.db('bot'+this.bot.selfId);
                oldDb = client.db('bot'+oldBotId);
                return pf.dcbp(fn => oldDb.listCollections().toArray(fn))
            })
            .then(result => {
                collections = result.map(doc => doc.name).filter(name => name !== 'system.indexes');
                return pf.allSync(collections.map(name => () => {
                    return pf.dcbp(fn => oldDb.collection(name).find({ chatId: fromChatId }).toArray(fn))
                        .then(docs => {
                            if (!docs || !docs.length) return;
                            docs.map(doc => {
                                doc.chatId = toChatId;
                                delete doc._id;
                            });
                            return pf.dcbp(fn => db.collection(name).insertMany(docs, fn));
                        })
                        .then(result => result && console.log(
                            'move info in collection',
                            name,
                            'from chat',
                            fromChatId,
                            'to chat',
                            toChatId,
                            'count',
                            result.result && result.result.n)
                        );
                }))
            })
            .then(() => {
                client.close();
            });
    }

    _transferInfo(fromChatId, toChatId, newBot = false) {
        return this._transferInfoFrom(fromChatId, toChatId, this.oldBot);
    }

    _moveChat(userId, fromChatId, message, command) {
        let users = [userId].concat(this.bot.additionalAccounts.map(vk => vk.selfId));
        if (this.bot.selfId !== this.adminId) users.push(this.bot.selfId);
        return this.bot.ctrlEmit(() => {
            let chat = this.bot.chats[fromChatId];
            let chatId;
            let title = `${Date.now()}${Math.round(Math.random() * 1e4)}`;
            let joinLink;
            // return message.setTitleTemplate(command.messageTemplate.failChat).send();
            return Promise.resolve()
                .then(() => this.vk.api.messages.createChat({ user_ids: users, title }))
                .then(result => {
                    let adminChatId = result + 2e9;
                    return this.vk.api.call('messages.getInviteLink', {
                        peer_id: adminChatId,
                    })
                })
                .then((link) => this.bot.vk.api.call('messages.joinChatByInviteLink', {link: joinLink = link}))
                .then(() => {
                    return this._findChat(title).then(result => chatId = result);
                })
                .then(() => chat && chat.final())
                .then(() => message && message.setTitleTemplate(command.messageTemplate.titleStart, fromChatId, chatId).send())
                .then(() => fromChatId && this._moveInfo(fromChatId, chatId))
                .then(() => {
                    return promiseFactory.allAsync(
                        [].concat(
                            this.bot.additionalAccounts.map(vk => {
                                return this.bot.ctrlEmit(() => {
                                    return vk.api.call('messages.joinChatByInviteLink', {link: joinLink});
                                }, 'addBotToChat', this.bot.chats[chatId] || new this.bot.Chat(chatId), vk.selfId);
                            })
                        )
                    )
                })
                .then(() => new Promise(resolve => setTimeout(resolve, 5e3)))
                .then(() => this.bot.removeChat(chatId))
                .then(() => message && message.new.setTitleTemplate(command.messageTemplate.title).send())
                .then(() => fromChatId && this.bot.vk.api.messages.removeChatUser({
                    member_id: this.bot.selfId,
                    chat_id: fromChatId - 2e9,
                    v: '5.81',
                }))
                .then(
                    () => chatId,
                    error => {
                        console.error(error);
                        let template = command.messageTemplate.fail;
                        if (error && error.code === 9) template = command.messageTemplate.failChat;
                        return message.new.setTitleTemplate(template).send()
                    }
                )
        }, this.eventNames.createVkChat, users)
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    moveChat(chat, message, command) {
        if (this.moveChats[chat.id] || chat.adminId !== 471756819) return;
        this.moveChats[chat.id] = true;
        let chatId;
        let [, link] = command.check.args.exec(message.getCommandText());
        return this.bot.vk.api.call('messages.getChatPreview', { link })
            .then(({ preview }) => {
                let result;
                if (preview.local_id) result = this.bot.vk.api.messages.addChatUser({
                    chat_id: preview.local_id,
                    user_id: this.bot.selfId,
                })
                    .catch(() => {})
                    .then(() => preview.local_id + 2e9);
                else result = this.bot.vk.api.call('messages.joinChatByInviteLink', { link })
                    .then(({ chat_id }) => chat_id + 2e9);
                return result
                    .then(id => {
                        if (!id) throw new Error('move chat has no id');
                        chatId = id;
                        return promiseFactory.allAsync(
                            this.bot.additionalAccounts.map(vk => {
                                return this.bot.ctrlEmit(() => {
                                    return vk.api.call('messages.joinChatByInviteLink', {link});
                                }, 'addBotToChat', new this.bot.Chat(chatId), vk.selfId);
                            })
                        )
                            .then(() => message.setTitleTemplate(command.messageTemplate.titleStart, chat.id, chatId).send({
                                antiCaptcha: { selfDirect: true }
                            }))
                            .then(() => this._deleteInfo(chatId))
                            .then(() => this._moveInfo(chat.id, chatId))
                            .then(() => message.new.setTitleTemplate(command.messageTemplate.title).send({
                                antiCaptcha: { selfDirect: true }
                            }))
                            .then(() => new this.bot.Message(chatId).setTitleTemplate(command.messageTemplate.title).send({
                                antiCaptcha: { selfDirect: true }
                            }))
                            .then(() => this.bot.removeChat(chatId))
                            .then(() => this.bot.vk.api.messages.removeChatUser({
                                member_id: this.bot.selfId,
                                chat_id: chat.id - 2e9,
                                v: '5.81'
                            }))
                    })
                    .catch(error => {
                        console.error(error);
                        return message.setTitleTemplate(command.messageTemplate.fail).send({
                            antiCaptcha: { selfDirect: true }
                        });
                    })
            }).catch(error => {
                let template = error.code === 917
                    ? command.messageTemplate.failInvite
                    : command.messageTemplate.failLink;
                return message.setTitleTemplate(template).send({
                    antiCaptcha: { selfDirect: true }
                });
            }).then(
                () => this.moveChats[chat.id] = false,
                () => this.moveChats[chat.id] = false
            )
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    reloadChat(chat, message, command) {
        let [, chatId] = command.check.args.exec(message.getCommandText());
        return this.bot
            .removeChat(chatId)
            .then(() => message.setTitleTemplate(command.messageTemplate.title, chatId).send());
    }


    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    createChat(chat, message, command) {
        let [, fromChatId, userId] = command.check.args.exec(message.getCommandText());
        if (fromChatId < 2e9) fromChatId += 2e9;
        fromChatId = +fromChatId;
        userId = +userId;
        // let users = [userId].concat(this.bot.additionalAccounts.map(vk => vk.selfId));
        let users = [userId];
        let chatId;
        return this.bot.ctrlEmit(users => {
            return this.vk.api.friends.areFriends({user_ids: userId})
                .then(friendsInfo => {
                    let result;
                    if (friendsInfo[0].friend_status === 2) {
                        result = this.vk.api.friends.add({ user_id: userId });
                    } else if (friendsInfo[0].friend_status === 3) {
                        result = Promise.resolve();
                    } else {
                        result = message.new.createReply().setTitleTemplate(command.messageTemplate.failFriend, userId, this.adminId).send()
                            .then(() => {
                                throw `user ${userId} not friend (command 'moveChat' module 'Admin')`;
                            });
                    }
                    // if (this.bot.selfId !== this.adminId) users.push(this.bot.selfId);
                    let title = `${Date.now()}${Math.round(Math.random() * 1e4)}`;
                    return result
                        .then(() => this.vk.api.messages.createChat({ user_ids: users, title }))
                        .then(result => {
                            let adminChatId = result + 2e9;
                            return this.vk.api.call('messages.getInviteLink', {
                                peer_id: adminChatId,
                            })
                        })
                        .then(({ link }) => {
                            return promiseFactory.allAsync(
                                [].concat(
                                    this.bot.additionalAccounts.map(vk => {
                                        return this.bot.ctrlEmit(() => {
                                            return vk.api.call('messages.joinChatByInviteLink', {link});
                                        }, 'addBotToChat', chat, vk.selfId);
                                    }),
                                    () => this.bot.vk.api.call('messages.joinChatByInviteLink', {link})
                                )
                            )
                        })
                        .then(result => {
                            return this._findChat(title).then(result => chatId = result);
                        })
                        .then(() => message.setTitleTemplate(command.messageTemplate.titleStart, fromChatId, chatId).send())
                        .then(() => this.bot.chats[fromChatId] && this.bot.chats[fromChatId].final())
                        .then(() => this._moveInfo(fromChatId, chatId))
                        .then(() => this.bot.removeChat(chatId))
                        .then(() => message.new.setTitleTemplate(command.messageTemplate.title).send(),
                            error => {
                                console.error(error);
                                return message.new.setTitleTemplate(command.messageTemplate.fail).send()
                            }
                        )
                        .then(() => chatId)
                });
        }, this.eventNames.createVkChat, users);
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    moveInfo(chat, message, command) {
        let [, fromChatId, toChatId] = command.check.args.exec(message.getCommandText());
        fromChatId = +fromChatId;
        toChatId = +toChatId;
        return message.setTitleTemplate(command.messageTemplate.titleStart, fromChatId, toChatId).send()
            .then(() => promiseFactory.allAsync([
                this.bot.chats[fromChatId] && this.bot.chats[fromChatId].final(),
                this.bot.chats[toChatId] && this.bot.chats[toChatId].final(),
            ]))
            .then(() => {
                let client, db, collections;
                return pf.dcbp(fn => MongoClient.connect('mongodb://localhost:27017', fn))
                    .then(result => {
                        client = result;
                        db = client.db('bot'+this.bot.selfId);
                        return pf.dcbp(fn => db.listCollections().toArray(fn))
                    })
                    .then(result => {
                        // collections = result.map(doc => doc.name).filter(name => name !== 'system.indexes');
                        // return pf.allSync(collections.map(name => () => {
                        //     return pf.dcbp(fn => db.collection(name).remove({ chatId: toChatId }, fn))
                        // }))
                    })
                    .then(() => {
                        client.close();
                    })
                    .then(() => this._moveInfo(fromChatId, toChatId))
                    .then(() => promiseFactory.allAsync([
                        this.bot.removeChat(fromChatId),
                        this.bot.removeChat(toChatId),
                    ]))
                    .then(() => message.new.setTitleTemplate(command.messageTemplate.title).send(),
                        error => {
                            console.error(error);
                            return message.new.setTitleTemplate(command.messageTemplate.fail).send()
                        }
                    )
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    deleteInfo(chat, message, command) {
        let [, chatId] = command.check.args.exec(message.getCommandText());
        chatId = +chatId;
        return message.setTitleTemplate(command.messageTemplate.titleStart, chatId).send()
            .then(() => promiseFactory.allAsync([
                this.bot.chats[chatId] && this.bot.chats[chatId].final(),
            ]))
            .then(() => {
                let client, db, collections;
                return pf.dcbp(fn => MongoClient.connect('mongodb://localhost:27017', fn))
                    .then(result => {
                        client = result;
                        // db = client.db('bot'+this.bot.selfId);
                        // return pf.dcbp(fn => db.listCollections().toArray(fn))
                    })
                    .then(result => {
                        // collections = result.map(doc => doc.name).filter(name => name !== 'system.indexes');
                        // return pf.allSync(collections.map(name => () => {
                        //     return pf.dcbp(fn => db.collection(name).remove({ chatId: toChatId }, fn))
                        // }))
                    })
                    .then(() => {
                        // client.close();
                    })
                    .then(() => this._deleteInfo(chatId))
                    .then(() => promiseFactory.allAsync([
                        this.bot.removeChat(chatId),
                    ]))
                    .then(() => message.new.setTitleTemplate(command.messageTemplate.title).send(),
                        error => {
                            console.error(error);
                            return message.new.setTitleTemplate(command.messageTemplate.fail).send()
                        }
                    )
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    transferInfo(chat, message, command) {
        let [, newBot, fromChatId, toChatId] = command.check.args.exec(message.getCommandText());
        fromChatId = +fromChatId;
        toChatId = +toChatId;
        return message.setTitleTemplate(command.messageTemplate.titleStart, fromChatId, toChatId).send()
            .then(() => promiseFactory.allAsync([
                this.bot.chats[toChatId] && this.bot.chats[toChatId].final(),
            ]))
            .then(() => {
                let client, db, collections;
                return this._transferInfo(fromChatId, toChatId, newBot)
                    .then(() => promiseFactory.allAsync([
                        this.bot.removeChat(fromChatId),
                        this.bot.removeChat(toChatId),
                    ]))
                    .then(() => message.new.setTitleTemplate(command.messageTemplate.title).send(),
                        error => {
                            console.error(error);
                            return message.new.setTitleTemplate(command.messageTemplate.fail).send()
                        }
                    )
        })
    }



    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    transferChat(chat, message, command) {
        let [, newChat, fromChatId, userId] = command.check.args.exec(message.getCommandText());
        if (fromChatId < 2e9) fromChatId += 2e9;
        fromChatId = +fromChatId;
        userId = +userId;
        // let users = [userId].concat(this.bot.additionalAccounts.map(vk => vk.selfId));
        let users = [userId];
        let chatId;
        return this.bot.ctrlEmit(users => {
            return this.vk.api.friends.areFriends({user_ids: userId})
                .then(friendsInfo => {
                    let result;
                    if (friendsInfo[0].friend_status === 2) {
                        result = this.vk.api.friends.add({ user_id: userId });
                    } else if (friendsInfo[0].friend_status === 3) {
                        result = Promise.resolve();
                    } else {
                        result = message.new.createReply().setTitleTemplate(command.messageTemplate.failFriend, userId, this.adminId).send()
                            .then(() => {
                                throw `user ${userId} not friend (command 'moveChat' module 'Admin')`;
                            });
                    }
                    // if (this.bot.selfId !== this.adminId) users.push(this.bot.selfId);
                    let title = `${Date.now()}${Math.round(Math.random() * 1e4)}`;
                    return result
                        .then(() => this.vk.api.messages.createChat({ user_ids: users, title }))
                        .then(result => {
                            let adminChatId = result + 2e9;
                            return this.vk.api.call('messages.getInviteLink', {
                                peer_id: adminChatId,
                            })
                        })
                        .then(({ link }) => {
                            return promiseFactory.allAsync(
                                [].concat(
                                    this.bot.additionalAccounts.map(vk => {
                                        return this.bot.ctrlEmit(() => {
                                            return vk.api.call('messages.joinChatByInviteLink', {link});
                                        }, 'addBotToChat', chat, vk.selfId);
                                    }),
                                    () => this.bot.vk.api.call('messages.joinChatByInviteLink', {link})
                                )
                            )
                        })
                        .then(result => {
                            return this._findChat(title).then(result => chatId = result);
                        })
                        .then(() => message.setTitleTemplate(command.messageTemplate.titleStart, fromChatId, chatId).send())
                        .then(() => this._transferInfo(fromChatId, chatId, newChat))
                        .then(() => this.bot.removeChat(chatId))
                        .then(() => message.new.setTitleTemplate(command.messageTemplate.title).send(),
                            error => {
                                console.error(error);
                                return message.new.setTitleTemplate(command.messageTemplate.fail).send()
                            }
                        )
                        .then(() => chatId)
                });
        }, this.eventNames.createVkChat, users);
    }

    showStatuses(chat, message, command) {
        let [, old, chatId] = command.check.args.exec(message.getCommandText());
        let botId = old ? this.oldBot : this.bot.vk.selfId;
        let client, db, collectionName = 'chatuserstatuses';
        return pf.dcbp(fn => MongoClient.connect('mongodb://localhost:27017', fn))
            .then(result => {
                client = result;
                db = client.db('bot' + botId);
                    return pf.dcbp(fn => db.collection(collectionName).find({ chatId: +chatId }).toArray(fn))
                        .then(docs => {
                            docs.sort((a, b) => b.status - a.status);
                            return message.setTitleTemplate(command.messageTemplate.title, chatId)
                                .setBodyTemplate(command.messageTemplate.body, n => docs[n].userId, n => docs[n].status)
                                .setTemplateLength(Math.min(docs.length, 5))
                                .send();
                        })
            })
            .then(() => {
                client.close();
            });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    addToChat(chat, message, command) {
        let args = message.initialText.split(' ');
        if (this.bot.isBotName(args[0])) args = args.slice(1);
        let [, link] = command.check.args.exec(args.join(' '));
        console.log('link', link);
        return this.bot.vk.api.call('messages.getChatPreview', { link })
            .then(({ preview }) => {
                let chat = new this.bot.Chat(0);
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
                                }, 'addBotToChat', chat, vk.selfId);
                            })
                        ).then(() => message.setTitleTemplate(command.messageTemplate.title, chatId).send())
                    })
                    .catch(error => {
                        console.error(error);
                        return message.setTitleTemplate(command.messageTemplate.fail).send();
                    })
            })
    }

    /**
     *
     * @returns {{create: string, emit: string, noNameEvent: string, newListenerPre: string, newListenerOn: string, newListenerAfter: string, newMiddlewarePre: string, newMiddlewareOn: string, removeListenerPre: string, removeListenerOn: string, removeListenerAfter: string, removeMiddlewarePre: string, removeMiddlewareOn: string, init: string, final: string, initChat: string, finalChat: string, runCommandByMessage: string, runCommand: string, createVkChat: string}}
     */
    get eventNames() {
        let eventNames = super.eventNames;
        eventNames.createVkChat = 'createVkChat';
        return eventNames;
    }
};
