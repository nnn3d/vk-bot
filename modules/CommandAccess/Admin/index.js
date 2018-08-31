'use strict';

const ModuleEventController = require('../../../classes/base/ModuleEventController');
const promiseFactory = require('../../../helpers/promiseFactory');
const pf = promiseFactory;
const ChatUserStatus = require('../../CommandAccess/ChatUserStatus');
const ChatCommandStatus = require('../../CommandAccess/ChatCommandStatus');
const ChatStatusNames = require('../../CommandAccess/ChatStatusNames');
const AdminBotChats = require('./AdminBotChats');
const MongoClient = require('mongodb').MongoClient;

module.exports = class Admin extends ModuleEventController {


    constructor({ token } = {}) {
        super();
        this.lastErrorMessage = {};
        this.kickChats = {};
        this.token = token;
        this.botChat = {};
        this.newsChannel = 'админ';
    }


    /**
     *
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            type: 'chat',
            vip: {
                paid: true,
            },
            commandList: {
                name: 'Администрирование',
                description: 'Работает, только если бот - админ чата, позволяет кикать пользователей, а так же запрещать приглашать пользователей всем, у кого статус меньше 1',
            },
            web: {
                icon: {
                    name: 'MdVpnKey',
                    options: {
                        color: '#1b4159',
                    }
                },
            },
            commands: [
                {
                    name: 'inviteToChat',
                    check: /^  $/,
                    commandList: {
                        name: 'приглашение новых участников',
                        hidden: true,
                    },
                    commandAccess: {
                        defaultStatus: 0,
                    },
                    messageTemplate: {
                        title: `у пользователя #{0} нет прав приглашать пользователей (статус < #{1})`,
                        autoKick: 'пользователь [id#{0}|#{1}] находится в списке автокика',
                    }
                },
                {
                    name: 'autoKick',
                    check: /^автокик ([a-zа-яё]+ ?[a-zа-яё]*|-?\d+)/i,
                    commandList: {
                        name: 'автокик пользователя',
                        usage: 'автокик (имя пользователя)',
                        description: 'автокик ([имя пользователя] или [id пользователя]) - удаляет пользователя из чата при любом появлении'
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'успешно добавлен в автокик пользователь - [id#{0}|#{1}]',
                        fail: 'не удалось добавить в автокик пользователя - [id#{0}|#{1}]',
                        failUser: 'не найден пользователь - #{0}',
                        failStatus: 'недостаточно прав для автокика пользователя - [id#{0}|#{1}]',
                        propsFail: `не указаны параметры`,
                    },
                    lists: {
                        listAction: {
                            name: 'автокик',
                            description: 'добавляет участников списка в автокик',
                            check: /^автокик$/i,
                            mapUsers: (users, actionName, self) => {
                                return users.map(userId => `автокик ${userId}`);
                            }
                        }
                    },
                    chatSpamBan: {
                        immunity: true
                    },
                    web: {
                        type: 'action',
                        submitText: 'добавить в автокик',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'showAutoKick',
                                'autoKick',
                                'deleteAutoKick',
                            ],
                        },
                        filter: (props, chat, message, self) => {
                            return {
                                users: {
                                    type: 'multi',
                                    data: chat.users.map(id => ({
                                        label: chat.userNames[id].fullName,
                                        value: id,
                                    })),
                                    options: {
                                        placeholder: 'участники',
                                        allowCreate: true,
                                    },
                                    clear: true,
                                },
                            };
                        },
                        output: (props, chat, message, self) => {
                            if (!props.users.length)
                                return Promise.resolve(self.messageTemplate.propsFail);
                            let result = Promise.resolve();
                            props.users.map(userId => {
                                result = result.then(() => {
                                    message.text = `автокик ${userId}`;
                                    return this[self.name](chat, message, self);
                                });
                            });
                            return result.then(() => message.getResult());
                        },
                    },
                },
                {
                    name: 'showAutoKick',
                    check: /^пока(?:жи|зать) автокик/i,
                    commandList: {
                        name: 'показать автокик',
                        description: 'показывает пользователей в автокике'
                    },
                    messageTemplate: {
                        title: 'пользователи в автокике:',
                        body: '• [id#{0}|#{1}] (id #{2})',
                        empty: 'ни одного пользователя нет в списке автокика'
                    },
                    chatSpamBan: {
                        immunity: true
                    },
                    web: {
                        type: props => props ? 'info' : 'action',
                        submitText: props => props ? '' : 'загрузить список автокика',
                    },
                },
                {
                    name: 'deleteAutoKick',
                    check: /^отменит?ь? автокик (-?\d+)/i,
                    commandList: {
                        name: 'отменить автокик пользователя',
                        usage: 'отменить автокик (id пользователя)',
                        description: 'отменяет пользователя из списка автокика'
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'успешно отменен автокик для пользователя - [id#{0}|#{1}]',
                        propsFail: `не указаны параметры`,
                        propsLoad: `список автокика загружен`,
                    },
                    web: {
                        type: props => 'action',
                        submitText: props => props ? 'отменить автокик' : 'загрузить список автокика',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'showAutoKick',
                                'autoKick',
                            ],
                        },
                        filter: (props, chat, message, self) => {
                            if (!props) return {};
                            return this._loadAutoKickUsers(chat.id)
                                .then(users => {
                                    return {
                                        users: {
                                            type: 'multi',
                                            data: users.map(user => ({
                                                label: `${user.first_name} ${user.last_name}`,
                                                value: user.id,
                                            })),
                                            options: {
                                                placeholder: 'участники',
                                                allowCreate: true,
                                            },
                                            clear: true,
                                        },
                                    };
                                })
                        },
                        output: (props, chat, message, self) => {
                            if (!props.users) {
                                return Promise.resolve(self.messageTemplate.propsLoad);
                            }
                            if (!props.users.length) {
                                return Promise.resolve(self.messageTemplate.propsFail);
                            }
                            let result = Promise.resolve();
                            props.users.map(userId => {
                                result = result.then(() => {
                                    message.text = `отменить автокик ${userId}`;
                                    return this[self.name](chat, message, self);
                                });
                            });
                            return result.then(() => message.getResult());
                        },
                    },
                },
                {
                    name: 'kick',
                    check: /^кик(?:ни|нуть)? ([a-zа-яё]+ ?[a-zа-яё]*|-?\d+)/i,
                    commandList: {
                        name: 'кикнуть пользователя',
                        usage: 'кик (имя пользователя)',
                        description: 'кик ([имя пользователя] или [id пользователя]) - удаляет пользователя из чата'
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'успешно кикнут пользователь - [id#{0}|#{1}]',
                        fail: 'не удалось кикнуть пользователя - [id#{0}|#{1}]',
                        failAdmin: 'не удалось кикнуть пользователя - [id#{0}|#{1}] (возможно бот не администратор в этой беседе)',
                        failUser: 'не найден пользователь - #{0}',
                        failStatus: 'недостаточно прав для кика пользователя - [id#{0}|#{1}]',
                    },
                    chatSpamBan: {
                        immunity: true
                    },
                },
                {
                    name: 'masskick',
                    check: /^масскик (.+)/i,
                    commandList: {
                        name: 'масскик',
                        usage: 'масскик (имя пользователя) { - имя пользователя} {...}',
                        description: 'масскик ([имя пользователя] или [id пользователя]) { - [имя пользователя] или [id пользователя]} - удаляет пользователя из чата'
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'успешно кикнут пользователь - [id#{0}|#{1}]',
                        fail: 'не удалось кикнуть пользователя - [id#{0}|#{1}]',
                        failAdmin: 'не удалось кикнуть пользователя - [id#{0}|#{1}] (возможно бот не администратор в этой беседе)',
                        failUser: 'не найден пользователь - #{0}',
                        failStatus: 'недостаточно прав для кика пользователя - [id#{0}|#{1}]',
                        failProps: 'не указаны параметры',
                    },
                    chatSpamBan: {
                        immunity: true
                    },
                    web: {
                        type: 'action',
                        submitText: 'кикнуть',
                        filter: (props, chat, message, self) => {
                            return {
                                users: {
                                    type: 'multi',
                                    data: chat.users.map(id => ({
                                        label: chat.userNames[id].fullName,
                                        value: id,
                                    })),
                                    options: {
                                        placeholder: 'участники',
                                        allowCreate: true,
                                    },
                                    clear: true,
                                },
                            };
                        },
                        output: (props, chat, message, self) => {
                            if (!props.users.length) return Promise.resolve(self.messageTemplate.failProps);
                            return `масскик ${props.users.join(',')}`;
                        },
                    },
                    lists: {
                        listAction: {
                            name: 'кик',
                            description: 'удаляет участников списка из чата',
                            check: /^кик$/i,
                            mapUsers: (users, actionName, self) => {
                                return `масскик ${users.join('-')}`
                            }
                        }
                    },
                },
                // {
                //     name: 'getChatLink',
                //     check: /^ссылка инвайт/i,
                //     commandList: {
                //         name: 'ссылка инвайт',
                //         description: 'получает ссылку для инвата в эту беседу',
                //     },
                //     commandAccess: {
                //         defaultStatus: 9,
                //     },
                //     messageTemplate: {
                //         title: 'ссылка на инвайт в эту беседу - #{0}',
                //         fail: 'не удалось получить ссылку для инвайта',
                //     },
                //     web: {},
                // },
                // {
                //     name: 'resetChatLink',
                //     check: /^ссылка сбросить/i,
                //     commandList: {
                //         name: 'ссылка сбросить',
                //         description: 'сбрасывает прошлую ссылку на инвайт в эту беседу',
                //     },
                //     commandAccess: {
                //         defaultStatus: 9,
                //     },
                //     messageTemplate: {
                //         title: 'ссылка на инвайт успешно сброшена',
                //         fail: 'не удалось сбросить ссылку на инвайт',
                //     },
                //     web: {
                //         type: 'action',
                //         submitText: 'сбросить ссылку на инвайт',
                //         change: {
                //             module: this.constructor.name,
                //             command: [
                //                 'getChatLink',
                //             ],
                //         },
                //     },
                // },
            ]
        }
    }

    _init(bot) {
        this.findBotTimeout = 6e4;
        return super._init(bot).then(() => {
            this.checkKickInterval = setInterval(() => {
                promiseFactory.allAsync(Object.keys(this.kickChats).map(chatId => {
                    if (this.kickChats[chatId].length > 3) {
                        const chat = this.bot.chats[chatId];
                        if (!chat) return;
                        return promiseFactory.allAsync(this.kickChats[chatId].map(userId => {
                            if (chat.adminId !== this.adminId) {
                                return this.bot.vk.api.messages.removeChatUser({
                                    chat_id: chatId - 2e9,
                                    member_id: userId,
                                    v: '5.81'
                                });
                            }
                            return this._getAdminChat(chatId).then(adminChatId => {
                                if (!adminChatId) {
                                    console.error(`can't find admin chat for chat ${chatId} on kick (module Admin)`);
                                    return null;
                                }
                                return this.vk.api.messages.removeChatUser({
                                    chat_id: adminChatId - 2e9,
                                    member_id: userId,
                                    v: '5.81'
                                });
                            })
                        }), false);
                    }
                })).then(() => this.kickChats = {});
            }, 3e4);
            if (!this.token) {
                this.vk = this.bot.vk;
                this.adminId = this.bot.selfId;
                return;
            }
            let config = this.token instanceof Object ? this.token : { token: this.token };
            this.vk = this.bot.createVk(Object.assign({}, this.bot.config.vk, config));
            return this.vk.api.users.get()
                .then((info) => {
                    if (!info[0] || !info[0].id) {
                        return this.final().then(() => {throw new Error(`no self id for Admin module`)});
                    }
                    this.adminId = info[0].id;
                    if (this.adminId === this.bot.selfId) {
                        this.vk = this.bot.vk;
                        return;
                    }
                    if (!this.bot.admins.includes(this.adminId)) this.bot.admins.push(this.adminId);
                    return pf.allAsync([
                        this.bot.Chat.global.pre(this.bot.Chat.eventNames.addUser, userId => {
                            if (userId === this.adminId) throw `don't add admin to chat users`;
                        }, this),
                        this.bot.pre('addBotToChat', this._onAddBotToChat, this),
                    ])
                });
        });
    }

    _final() {
        clearInterval(this.checkKickInterval);
        return super._final().then(promiseFactory.allAsync([
            this.bot.removeListenersPreByHandler('addBotToChat', this),
            this.bot.Chat.global.removeListenersPreByHandler(this.bot.Chat.eventNames.addUser, this)
        ]));
    }

    /**
     *
     * @param {Chat} chat
     * @returns {Promise.<*>}
     * @private
     */
    _initChat(chat) {
        const isAdmin = (chat.adminId === this.adminId);
        return super._initChat(chat).then(() => promiseFactory.allAsync([
            chat.pre(chat.eventNames['chat.invite'], (info) => this.invitation(chat, info), this),
            chat.after(chat.eventNames['chat.invite'], (info) => this._onInvite(chat, info), this),
            chat.on(chat.eventNames['chat.kick'], (info) => this.leavekick(chat, info), this),
            isAdmin && this._findBotChat(chat),
        ]));
    }

    _finalChat(chat) {
        return super._finalChat(chat).then(() => promiseFactory.allAsync([
            chat.removeListenersPreByHandler(chat.eventNames['chat.invite'], this),
            chat.removeListenersAfterByHandler(chat.eventNames['chat.invite'], this),
            chat.removeListenersOnByHandler(chat.eventNames['chat.kick'], this),
        ]))
    }

    _onAddBotToChat(chat, botId) {
        if (botId === this.adminId) throw 'dont add admin in chats';
    }

    _onInvite(chat, info) {
        if (info.user === info.invite) {
            if (info.link) {
                chat.emit('News.add', this.newsChannel, `пользователь [id${info.user}|${chat.userNames[info.user].fullName}] присоединился к беседе по ссылке`);
            } else {
                chat.emit('News.add', this.newsChannel, `пользователь [id${info.user}|${chat.userNames[info.user].fullName}] вернулся в беседу`);
            }
        } else {
            chat.emit('News.add', this.newsChannel, `пользователь [id${info.user}|${chat.userNames[info.user].fullName}] пригласил в беседу [id${info.invite}|${info.invite}]`);
        }
        return Promise.resolve();
    }

    _sendErrorMessage(chatId, text, ...args) {
        if (Date.now() - this.lastErrorMessage[chatId] < 5e3) {
            this.lastErrorMessage[chatId] = Date.now();
            return Promise.resolve();
        }
        this.lastErrorMessage[chatId] = Date.now();
        return new this.bot.Message({peer: chatId})
            .setTitleTemplate(text, ...args)
            .send()
    }

    /**
     *
     * @param {Chat} chat
     * @param {Number} userId
     * @returns {Promise}
     * @private
     */
    _kick(chat, userId) {
        if (chat.disabled) return false;
        if (!this.kickChats[chat.id]) this.kickChats[chat.id] = [];
        if (!this.kickChats[chat.id].includes(userId)) {
            this.kickChats[chat.id].push(userId);
        }
        if (this.bot.admins.includes(userId)) return null;
        return this.bot.vk.api.messages.removeChatUser({
            chat_id: chat.id - 2e9,
            member_id: userId,
            v: '5.81'
        });

    }

    /**
     *
     * @param {Chat} chat
     * @param {Number} fromUser
     * @param {Number} toUser
     * @returns {Promise<(true|false|null)>}
     * @private
     */
    _tryKick(chat, fromUser, toUser) {
        if (chat.disabled) {
            return Promise.resolve(false);
        }
        return promiseFactory.allAsync([
            this._getAdminChat(chat.id),
            this._getUserStatus(chat, fromUser),
            this._getUserStatus(chat, toUser),
        ]).then(([adminChatId, fromStatus, toStatus]) => {
            if (!adminChatId && chat.adminId === this.adminId) {
                console.error(`can't find admin chat for chat ${chat.id} (module Admin)`);
                return Promise.resolve(false);
            }
            if (fromStatus <= toStatus) return null;
            console.log('kick user', toUser, 'from chat', chat.id, 'map admin chat', adminChatId, 'admin id', this.adminId);
            let result;
            result = this.bot.vk.api.messages.removeChatUser({
                chat_id: chat.id - 2e9,
                member_id: toUser,
                v: '5.81'
            })
            return result
                .then(() => true)
                .catch(() => false);
        });
    }

    _findBotChat(chat) {
        if (this.bot.selfId === this.adminId) return;
        return AdminBotChats.findOne({
            selfId: this.bot.selfId,
            botId: this.adminId,
            selfChatId: chat.id,
        }).exec().then(doc => {
            if (doc) {
                this.botChat[chat.id] = doc.botChatId;
                return;
            }
            let photo = null;
            let findIteration = (count = 200, offset = 0) => {
                return this.vk.api.messages.getDialogs({ count, offset }).then(response => {
                    if (!response.items.length) {
                        setTimeout(() => {
                            return this._findBotChat(chat);
                        }, this.findBotTimeout);
                        console.error(`cant find chat ${chat.id} to Admin module (bot ${this.adminId}`);
                        return;
                    }
                    for (let { message } of response.items) {
                        if (!message.chat_id) continue;
                        if (message.photo_50 === photo
                            || (message.title === chat.title
                                && message.admin_id === chat.adminId)) {
                            return this.vk.api.messages.getChatUsers({ chat_id: message.chat_id }).then(chatUsers => {
                                if (chat.users.filter(userId => !chatUsers.includes(userId)).length) return;
                                let botChatId = message.chat_id + 2e9;
                                this.botChat[chat.id] = botChatId;
                                return AdminBotChats.findOneAndUpdate({
                                    selfId: this.bot.selfId,
                                    botId: this.adminId,
                                    selfChatId: chat.id,
                                }, {
                                    botChatId,
                                }, {
                                    upsert: true,
                                }).exec()
                            })
                        }
                    }
                    return findIteration(count, offset + count);
                })
            };
            return this.bot.vk.api.messages.getChat({
                chat_id: chat.id - 2e9,
            }).then(chatInfo => {
                if (chatInfo.photo_50) photo = chatInfo.photo_50;
                return findIteration();
            })
        })
    }

    _getAdminChat(chatId) {
        if (this.bot.selfId === this.adminId) return Promise.resolve(chatId);
        if (this.botChat[chatId]) return Promise.resolve(this.botChat[chatId]);
        return AdminBotChats.findOne({
            selfId: this.bot.selfId,
            botId: this.adminId,
            selfChatId: chatId,
        }).exec().then(doc => {
            if (doc) {
                this.botChat[chatId] = doc.botChatId;
                return Promise.resolve(doc.botChatId);
            } else return Promise.resolve(null);
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {String|Number} nameOrId
     * @return {Promise.<Number>}
     * @private
     */
    _getUserStatus(chat, nameOrId) {
        let result = Promise.resolve();
        return result.then(() => {
            if (this.bot.selfId === nameOrId) return 11;
            let userId = chat.findUser(nameOrId);
            if (!userId) return 0;
            if (chat.adminId === userId || this.bot.admins.includes(userId))
                return 10;
            return ChatUserStatus.findOne({ chatId: chat.id, userId }).exec()
                .then(user => {
                    return user && user.status || 0;
                });
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Object} info
     *
     */
    invitation(chat, info){
        let commandName = 'inviteToChat';
        let command = this.specification.commands.filter(command => command.name === commandName)[0];
        if (info.user === info.invite || !command) return;
        return promiseFactory.allAsync([
            this._getUserStatus(chat, info.user),
            ChatCommandStatus.findOne({
                chatId: chat.id,
                moduleName: this.specification.name,
                commandName,
            }),
            ChatUserStatus.findOne({ chatId: chat.id, userId: info.invite }).exec(),
        ]).then(([userStatus, commandDoc, inviteDoc]) => {
            let status = commandDoc && commandDoc.status
                || !commandDoc && command.commandAccess && command.commandAccess.defaultStatus || 0;
            if (userStatus < status) {
                if (info.user === this.adminId || this.bot.admins.includes(info.user)) return;
                chat.emit('News.add', this.newsChannel, `пользователь [id${info.user}|${chat.userNames[info.user].fullName}] пригласил пользователя [id${info.invite}|${info.invite}], но не имел достаточный статус (${userStatus} < ${status}), из-за чего оба были исключены из беседы`);
                console.log('auto kick from chat', chat.id, 'when user', info.user, 'invite', info.invite);
                return promiseFactory.allAsync([
                    this._sendErrorMessage(
                        chat.id,
                        command.messageTemplate.title,
                        chat.userNames[info.user].fullName,
                        status
                    ),
                    this._kick(chat, info.invite),
                    this._kick(chat, info.user),
                ])
                    .then(() => {
                        throw `user ${info.user} cant invite user ${info.invite}`;
                    })
            } else if (inviteDoc && inviteDoc.autoKick) {
                chat.emit('News.add', this.newsChannel, `пользователь [id${info.user}|${chat.userNames[info.user].fullName}] пригласил пользователя [id${info.invite}|${info.invite}], который находится в списке автокика и был исключен из беседы`);
                console.log('auto kick from chat', chat.id, 'user', info.invite);
                return promiseFactory.allAsync([
                    this._sendErrorMessage(
                        chat.id,
                        command.messageTemplate.autoKick,
                        info.invite,
                        info.invite
                    ),
                    this._kick(chat, info.invite),
                ])
            } else {
                if (this.kickChats[chat.id] && this.kickChats[chat.id].includes(info.invite)) {
                    this.kickChats[chat.id].splice(this.kickChats[chat.id].indexOf(info.invite), 1);
                }
            }
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Object} info
     */
    leavekick(chat, info) {
        if (chat.disabled) return;
        if (info.user !== info.kick) {
            if (info.user !== this.adminId) {
                chat.emit('News.add', this.newsChannel, `пользователь [id${info.user}|${chat.userNames[info.user].fullName}] исключил из беседы [id${info.kick}|${chat.userNames[info.kick].fullName}]`);
            }
            return;
        }
        return pf.allAsync([
            ChatCommandStatus.findOne({chatId: chat.id, moduleName: this.constructor.name, commandName: 'kick'}),
            this._getUserStatus(chat, info.kick)
        ]).then(([commandDoc, userStatus]) => {
            if (userStatus === 10) return;
            let neededStatus = commandDoc ? commandDoc.status : 9;
            const parse = (message) => {
                if (/^да кикнуть/i.test(message.text)) {
                    this._getUserStatus(chat, message.user)
                        .then((userStatus) => {
                            if (userStatus >= neededStatus) {
                                chat.emit('News.add', this.newsChannel, `пользователь [id${info.kick}|${chat.userNames[info.kick].fullName}] покинул беседу и [id${info.user}|${chat.userNames[info.user].fullName}] исключил его`);
                                return chat.removeListenerOn(chat.eventNames.message, parse)
                                    .then(() => this._kick(chat, info.user));

                            }

                        });

                }
            };
            setTimeout(() => {
                chat.emit('News.add', this.newsChannel, `пользователь [id${info.kick}|${chat.userNames[info.kick].fullName}] покинул беседу`);
                return chat.removeListenerOn(chat.eventNames.message, parse)
            }, 60000);
            return chat.on(chat.eventNames.message, parse, this)
                .then(() => {
                    return new this.bot.Message(this.bot, {peer: chat.id})
                        .setTitle(`Кикнуть вышедшего пользователя [id${info.kick}|${chat.userNames[info.kick].fullName}]? (Написать "да кикнуть" сейчас или "мия кик ${info.kick}" для кика в любое время, необходимый статус - ${neededStatus} или выше)`)
                        .send();
                })
        })

    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    autoKick(chat, message, command) {
        let info = command.check.exec(message.getCommandText());
        let nameOrId = info[1];
        let userId = chat.findUser(nameOrId);
        if (!userId) {
            if (!isNaN(+nameOrId) && +nameOrId < 2e9) userId = +nameOrId;
            else return message.setTitleTemplate(command.messageTemplate.failUser, nameOrId).send();
        }
        let userName = chat.userNames[userId].fullName;
        return this._tryKick(chat, message.user, userId).then(result => {
            let template;
            let addToAutoKick = Promise.resolve();
            switch (result) {
                case null:
                    template = command.messageTemplate.failStatus;
                    break;
                case false:
                    template = command.messageTemplate.title;
                    addToAutoKick = ChatUserStatus.findOneAndUpdate(
                        { chatId: chat.id, userId },
                        { autoKick: true },
                        { upsert: true }
                    );
                    break;
                case true:
                    template = command.messageTemplate.title;
                    addToAutoKick = ChatUserStatus.findOneAndUpdate(
                        { chatId: chat.id, userId },
                        { autoKick: true },
                        { upsert: true }
                    );
                    break;
                default:
                    template = command.messageTemplate.fail;
            }
            return addToAutoKick
                .then(() => {
                    return message
                        .setTitleTemplate(template, userId, userName)
                        .send({
                            news: {
                                channel: this.newsChannel,
                                fromUser: message.user,
                            }
                        })
                });
        });
    }

    _loadAutoKickUsers(chatId) {
        return ChatUserStatus.find({
            chatId: chatId,
            autoKick: true,
        }).exec().then(docs => {
            let userIds = docs.map(doc => doc.userId).filter(id => id < 2e9);
            if (!userIds.length) return [];
            return this.bot.vk.api.users.get({user_ids: userIds.join(',')});
        });
    }

    _findUser(chat, nameOrId) {
        let userId;
        if (!nameOrId) return;
        if (chat.allUsers.includes(+nameOrId)) return +nameOrId;
        let nameExp = new RegExp(`^${nameOrId}`, 'i');
        chat.allUsers.forEach(user => {
            if (nameExp.test(`${chat.userNames[user].name} ${chat.userNames[user].secondName}`)
                || nameExp.test(`${chat.userNames[user].secondName} ${chat.userNames[user].name}`)
                || nameExp.test(user)) {
                userId = user;
            }
        });
        return userId;
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showAutoKick(chat, message, command) {
        return this._loadAutoKickUsers(chat.id)
                .then(users => {
                    if (!users.length) return message.setTitle(command.messageTemplate.empty).send();
                    return message
                        .setTitleTemplate(command.messageTemplate.title)
                        .setBodyTemplate(
                            command.messageTemplate.body,
                            i => users[i].id,
                            i => `${users[i].first_name} ${users[i].last_name}`,
                            i => users[i].id
                        )
                        .setTemplateLength(users.length)
                        .send();
                });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    deleteAutoKick(chat, message, command) {
        let info = command.check.exec(message.getCommandText());
        let userId = info[1];
        let userName = chat.userNames[userId].fullName;
        return ChatUserStatus.findOneAndUpdate(
            { chatId: chat.id, userId },
            { autoKick: false },
            { upsert: true }
        ).then(() => {
            return message
                .setTitleTemplate(command.messageTemplate.title, userId, userId)
                .send({
                    news: {
                        channel: this.newsChannel,
                        fromUser: message.user,
                    }
                })
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    kick(chat, message, command) {
        let info = command.check.exec(message.getCommandText());
        let nameOrId = info[1];
        let userId = this._findUser(chat, nameOrId);
        if (!userId) {
            if (!isNaN(+nameOrId)) userId = +nameOrId;
            else return message.setTitleTemplate(command.messageTemplate.failUser, nameOrId).send();
        }
        let userName = chat.userNames[userId].fullName;
        return this._tryKick(chat, message.user, userId).then(result => {
            let template = command.messageTemplate.fail;
            let messageParams = {};
            switch (result) {
                case null:
                    template = command.messageTemplate.failStatus;
                    break;
                case false:
                    template = chat.adminId === this.adminId
                        ? command.messageTemplate.fail
                        : command.messageTemplate.failAdmin;
                    break;
                case true:
                    messageParams = {
                        news: {
                            channel: this.newsChannel,
                            fromUser: message.user,
                        }
                    };
                    template = command.messageTemplate.title;
                    break;
            }
            return message
                .setTitleTemplate(template, userId, userName)
                .send(messageParams);
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    masskick(chat, message, command) {
        let info = message.getCommandArgs().slice(1).join(' ').split(/\s*[\-,]\s*/);
        let text = [];
        return promiseFactory.allAsync(info.map(nameOrId => {
            let userId = this._findUser(chat, nameOrId);
            if (!userId) {
                if (!isNaN(+nameOrId)) userId = +nameOrId;
                else {
                    text.push(message.new.setTitleTemplate(command.messageTemplate.failUser, nameOrId).getText());
                    return;
                }
            }
            let userName = chat.userNames[userId].fullName;
            return this._tryKick(chat, message.user, userId).then(result => {
                let template = command.messageTemplate.fail;
                switch (result) {
                    case null:
                        template = command.messageTemplate.failStatus;
                        break;
                    case false:
                        template = chat.adminId === this.adminId
                            ? command.messageTemplate.fail
                            : command.messageTemplate.failAdmin;
                        break;
                    case true:
                        template = command.messageTemplate.title;
                        break;
                }
                text.push(message.new.setTitleTemplate(template, userId, userName).getText());
            });
        })).then(() => {
            return message.new.setTitle(text.join('\n')).send({
                news: {
                    channel: this.newsChannel,
                    fromUser: message.user,
                }
            })
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    getChatLink(chat, message, command) {
        return this._getAdminChat(chat.id).then(adminChatId => {
            if (!adminChatId) {
                console.error(`can't find admin chat for chat ${chat.id} (module Admin)`);
                return message.setTitle(command.messageTemplate.fail).send();
            }
            return this.vk.api.call('messages.getInviteLink', {
                peer_id: adminChatId,
            }).then(({ link }) => {
                return message.setTitleTemplate(command.messageTemplate.title, link).send({
                    chatSpamBan: { link: true },
                });
            }).catch(error => {
                console.error(error);
                return message.setTitle(command.messageTemplate.fail).send();
            })
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    resetChatLink(chat, message, command) {
        return this._getAdminChat(chat.id).then(adminChatId => {
            if (!adminChatId) {
                console.error(`can't find admin chat for chat ${chat.id} (module Admin)`);
                return message.setTitle(command.messageTemplate.fail).send();
            }
            return this.vk.api.call('messages.getInviteLink', {
                peer_id: adminChatId,
                reset: 1,
            }).then(({ link }) => {
                return message.setTitleTemplate(command.messageTemplate.title).send();
            }).catch(error => {
                console.error(error);
                return message.setTitle(command.messageTemplate.fail).send({
                    news: {
                        channel: this.newsChannel,
                        fromUser: message.user,
                    }
                });
            })
        });
    }
};
