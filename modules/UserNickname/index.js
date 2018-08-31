'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const CoreModuleEventController = require('../../classes/base/CoreModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const UserMedal = require('./UserMedal');
const UserNicknameModel = require('./UserNickname');

module.exports = class UserNickname extends ModuleEventController {

    /**
     * @typedef {Object} SpecificationCommand_UserNickname
     * @property {boolean} [prefix] if true, in send message add prefix with user nickname
     *
     */

    constructor() {
        super();
        this.userNamesProxy = {
            get(target, property) {
                if (typeof property === 'symbol' || isNaN(property)) return target[property];
                let info = target[property];
                if (info.medal && info.secondName) {
                    info.fullName = `${info.name} ${info.secondName} ${info.medal}`;
                }
                return info;
            }
        };
        this.newsChannel = 'ники';
    }

    /**
     *
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            type: 'chat',
            commandList: {
                name: 'Ники',
                description: 'позволяет устанавливать участникам ники и медали, с помощью ников можно вызывать все команды, в которых используются имена'
            },
            web: {
                icon: {
                    name: 'FaBullhorn',
                    options: {
                        color: '#60a0a8',
                    }
                },
            },
            messageTemplate: {
                nicknameMessage: '#{0}',
                nicknameMessagePrefix: '#{0}, #{1}',
            },
            commands: [
                {
                    name: 'addNickname',
                    check: {
                        args: /^(?!удалить)([a-zа-яё]+ ?[a-zа-яё]*|\d+) ник (.+)$/i,
                    },
                    commandList: {
                        name: 'установить ник',
                        usage: '(имя) ник (новый ник)',
                        description: 'устанавливает ник для участника',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'для участника #{0} успешно установлен ник "#{1}"',
                        failUser: 'не найден участник #{0}',
                        failProps: 'не указаны параметры',
                    },
                    vip: {
                        usages: 15,
                    },
                    lists: {
                        listAction: {
                            name: 'установить ник (новый ник)',
                            check: /^установить ник (.+)$/i,
                            mapUsers: (users, actionName, self) => {
                                let [, nickname] = self.check.exec(actionName);
                                return users.map(userId => `${userId} ник ${nickname}`);
                            }
                        }
                    },
                    web: {
                        type: 'action',
                        submitText: 'установить ник',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'deleteNickname',
                                'showNicknames',
                            ],
                        },
                        filter: (props, chat, message) => {
                            return {
                                user: {
                                    type: 'select',
                                    options: {
                                        placeholder: 'участник',
                                    },
                                    data: chat.users.map(id => ({
                                        label: chat.userNames[id].fullName,
                                        value: id,
                                        default: id === message.user,
                                    })),
                                    clear: true,
                                },
                                nick: {
                                    type: 'text',
                                    options: {
                                        placeholder: 'новый ник',
                                    },
                                    clear: true,
                                },
                            }
                        },
                        output: (props, chat, message, command) => {
                            if (!props.user || !props.nick) {
                                return Promise.resolve(command.messageTemplate.failProps);
                            }
                            return `${props.user} ник ${props.nick}`;
                        }
                    }
                },
                {
                    name: 'deleteNickname',
                    check: {
                        args: /^удалить ник ([a-zа-яё]+ ?[a-zа-яё]*|\d+)$/i,
                    },
                    commandList: {
                        name: 'удалить ник',
                        usage: 'удалить ник (имя)',
                        description: 'удаляет ник у участника',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'у участника #{0} успешно удален ник',
                        failUser: 'не найден участник #{0}',
                        failProps: 'не указаны параметры',
                    },
                    lists: {
                        listAction: {
                            name: 'удалить ник',
                            check: /^удалить ник$/i,
                            mapUsers: (users, actionName, self) => {
                                return users.map(userId => `удалить ник ${userId}`);
                            }
                        }
                    },
                    web: {
                        type: 'action',
                        submitText: 'удалить ник',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'deleteNickname',
                                'showNicknames',
                            ],
                        },
                        filter: (props, chat, message) => {
                            return UserNicknameModel.find({ chatId: chat.id, userId: { $in: chat.users } }).exec().then(docs => {
                                return {
                                    user: {
                                        type: 'select',
                                        options: {
                                            placeholder: 'участник',
                                        },
                                        data: docs.map(doc => ({
                                            label: `${chat.userNames[doc.userId].fullName} (${doc.nickname})`,
                                            value: doc.userId,
                                            default: doc.userId === message.user,
                                        })),
                                        clear: true,
                                    },
                                }
                            })
                        },
                        output: (props, chat, message, command) => {
                            if (!props.user) {
                                return Promise.resolve(command.messageTemplate.failProps);
                            }
                            return `удалить ник ${props.user}`;
                        }
                    }
                },
                {
                    name: 'showNicknames',
                    check: {
                        args: /^ники$/i,
                    },
                    commandList: {
                        name: 'ники',
                        description: 'показывает ники участников чата'
                    },
                    messageTemplate: {
                        title: 'ники участников чата:',
                        body: '#{0} - #{1}',
                        fail: 'ни у одного участника нет ника',
                    },
                    web: {},
                },
                {
                    name: 'addMedal',
                    check: {
                        args: /^(?!удалить)([a-zа-яё]+ ?[a-zа-яё]*|\d+) медаль ([\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]).*$/iu,
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    commandList: {
                        name: 'установить медаль',
                        usage: '(имя) медаль (смайл)',
                        description: 'устанавливает медаль для участника',
                    },
                    messageTemplate: {
                        title: 'для участника #{0} успешно установлена медаль #{1}',
                        failUser: 'не найден участник #{0}',
                        failProps: 'не указаны параметры',
                        failMedal: 'медаль должна быть смайлом или спецсимволом',
                    },
                    vip: {
                        usages: 15,
                    },
                    lists: {
                        listAction: {
                            name: 'установить медаль (смайл или символ)',
                            check: /^установить медаль ([\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]).*$/ui,
                            mapUsers: (users, actionName, self) => {
                                let [, medal] = self.check.exec(actionName);
                                return users.map(userId => `${userId} медаль ${medal}`);
                            }
                        }
                    },
                    web: {
                        type: 'action',
                        submitText: 'установить медаль',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'deleteMedal',
                                'showMedals',
                            ],
                        },
                        filter: (props, chat, message) => {
                            return {
                                user: {
                                    type: 'select',
                                    options: {
                                        placeholder: 'участник',
                                    },
                                    data: chat.users.map(id => ({
                                        label: chat.userNames[id].fullName,
                                        value: id,
                                        default: id === message.user,
                                    })),
                                    clear: true,
                                },
                                medal: {
                                    type: 'text',
                                    options: {
                                        placeholder: 'медаль (смайл или спецсимвол)',
                                    },
                                    clear: true,
                                },
                            }
                        },
                        output: (props, chat, message, command) => {
                            if (!props.user || !props.medal) {
                                return Promise.resolve(command.messageTemplate.failProps);
                            }
                            let [, , medal] = command.check.args.exec(`${props.user} медаль ${props.medal}`);
                            if (!medal) return Promise.resolve(command.messageTemplate.failMedal);
                            return `${props.user} медаль ${medal}`;
                        }
                    },
                },
                {
                    name: 'deleteMedal',
                    check: {
                        args: /^удалить медаль ([a-zа-яё]+ ?[a-zа-яё]*|\d+)$/i,
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    commandList: {
                        name: 'удалить медаль',
                        usage: 'удалить медаль (имя)',
                        description: 'удаляет медаль для участника',
                    },
                    messageTemplate: {
                        title: 'для участника #{0} успешно удалена медаль',
                        failUser: 'не найден участник #{0}',
                        failProps: 'не указаны параметры',
                    },
                    web: {
                        type: 'action',
                        submitText: 'удалить медаль',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'deleteMedal',
                                'showMedals',
                            ],
                        },
                        filter: (props, chat, message) => {
                            return UserMedal.find({ chatId: chat.id, userId: { $in: chat.users } }).exec().then(docs => {
                                return {
                                    user: {
                                        type: 'select',
                                        options: {
                                            placeholder: 'участник',
                                        },
                                        data: docs.map(doc => ({
                                            label: chat.userNames[doc.userId].fullName,
                                            value: doc.userId,
                                            default: doc.userId === message.user,
                                        })),
                                        clear: true,
                                    },
                                }
                            })
                        },
                        output: (props, chat, message, command) => {
                            if (!props.user) {
                                return Promise.resolve(command.messageTemplate.failProps);
                            }
                            return `удалить медаль ${props.user}`;
                        }
                    },
                    lists: {
                        listAction: {
                            name: 'удалить медаль',
                            check: /^удалить медаль$/i,
                            mapUsers: (users, actionName, self) => {
                                return users.map(userId => `удалить медаль ${userId}`);
                            }
                        }
                    },
                },
                {
                    name: 'showMedals',
                    check: {
                        args: /^медали$/i,
                    },
                    commandList: {
                        name: 'медали',
                        description: 'показывает медали участников чата',
                    },
                    messageTemplate: {
                        title: 'медали участников чата:',
                        body: '#{0}',
                        bodyWeb: '#{0} - #{1}',
                        fail: 'ни у одного участника нет медали',
                    },
                    web: {
                        output: (props, chat, message, command) => {
                            command.messageTemplate = Object.assign({}, command.messageTemplate);
                            command.messageTemplate.body = command.messageTemplate.bodyWeb;
                        }
                    },
                },
            ],
        };
    }

    _init(bot) {
        return super._init(bot).then(() => {
            this._defaultFindUser = bot.Chat.prototype.findUser;
            process.on('message', packet => {
                if (!packet || !packet.data || !this.bot.chats[packet.data.chatId]
                    || this.bot.clusterMode && this.bot.clusterMode.isClusterChat(packet.data.chatId)) return;
                switch (packet.topic) {
                    case 'userNicknameSetNickname':
                        this._addNickname(this.bot.chats[packet.data.chatId], packet.data.userId, packet.data.nickname);
                        break;
                    case 'userNicknameDeleteNickname':
                        this._deleteNickname(this.bot.chats[packet.data.chatId], packet.data.userId);
                        break;
                    case 'userNicknameSetMedal':
                        this._addMedal(this.bot.chats[packet.data.chatId], packet.data.userId, packet.data.medal);
                        break;
                    case 'userNicknameDeleteMedal':
                        this._deleteMedal(this.bot.chats[packet.data.chatId], packet.data.userId);
                        break;
                }
            });
            return promiseFactory.allAsync([
                ModuleEventController.global.middlewareOn(
                    this.eventNames.runCommand,
                    this._middlewareRunCommand,
                    this
                ),
                CoreModuleEventController.global.middlewareOn(
                    this.eventNames.runCommand,
                    this._middlewareRunCommand,
                    this
                ),
            ])
        });
    }

    _final() {
        return super._final().then(() => promiseFactory.allAsync([
            ModuleEventController.global.removeMiddlewareOnByHandler(
                this.eventNames.runCommand,
                this
            ),
            CoreModuleEventController.global.middlewareOn(
                this.eventNames.runCommand,
                this
            ),
        ]));
    }

    _initChat(chat) {
        return super._initChat(chat).then(() => {
            let self = this;
            chat.findUser = function (nameOrId) {
                return self._findUser(this, nameOrId);
            };
            chat.userNicknames = {};
            chat.userNames = new Proxy(chat.userNames, this.userNamesProxy);
            return promiseFactory.allAsync([
                UserNicknameModel.find({ chatId: chat.id }).exec(),
                UserMedal.find({ chatId: chat.id }).exec(),
            ]).then(([nicknames, medals]) => {
                nicknames
                    .filter(doc => chat.users.includes(doc.userId))
                    .map(doc => this._addNickname(chat, doc.userId, doc.nickname));
                medals
                    .filter(doc => chat.users.includes(doc.userId))
                    .map(doc => this._addMedal(chat, doc.userId, doc.medal));
            })
        });
    }

    _finalChat(chat) {
        return super._finalChat(chat).then(() => {
            chat.findUser = this._defaultFindUser;
            delete chat.userNicknames;
        });
    }

    _findUser(chat, nameOrId) {
        let userId;
        if (!nameOrId) return;
        userId = this._defaultFindUser.call(chat, nameOrId);
        if (userId || !chat.userNicknames) return userId;
        let nameExp = new RegExp(`^${nameOrId}`, 'i');
        chat.users.forEach(user => {
            if (!chat.userNicknames[user]) return;
            if (nameExp.test(chat.userNicknames[user])) {
                userId = user;
            }
        });
        return userId;
    }

    _addNickname(chat, userId, nickname) {
        if (!chat.userNicknames) chat.userNicknames = {};
        chat.userNicknames[userId] = nickname;
    }

    _deleteNickname(chat, userId) {
        if (!chat.userNicknames) return;
        delete chat.userNicknames[userId];
    }

    _addMedal(chat, userId, medal) {
        chat.userNames[userId].medal = medal;
    }

    _deleteMedal(chat, userId) {
        delete chat.userNames[userId].medal;
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     * @param {ModuleEventController} module
     */
    _middlewareRunCommand([chat, message, command], module) {
        if (!command.userNickname || !chat.modules.includes(this)) return;
        if (command.userNickname.prefix && chat.userNicknames[message.user]) {
            return message.pre(this.bot.Message.eventNames.sendInit, params => {
                let text = message.getText();
                let template = this.specification.messageTemplate[(text ? 'nicknameMessagePrefix' : 'nicknameMessage')];
                message.new.setTitleTemplate(template, chat.userNicknames[message.user], text);
            });
        }
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    addNickname(chat, message, command) {
        let [, nameOrId, nickname] = command.check.args.exec(message.getCommandText());
        nickname = nickname.replace(/[.]/ig, '');
        if (!nickname) return;
        let userId = chat.findUser(nameOrId);
        if (!userId) return message.setTitleTemplate(command.messageTemplate.failUser, nameOrId).send();
        return UserNicknameModel.findOneAndUpdate(
            { chatId: chat.id, userId },
            { nickname },
            { upsert: true }
        ).exec().then(() => {
            this._addNickname(chat, userId, nickname);
            if (this.bot.clusterMode && this.bot.clusterMode.isClusterChat(chat.id)) {
                this.bot.clusterMode.send({
                    topic: 'userNicknameSetNickname',
                    data: {
                        chatId: chat.id,
                        userId,
                        nickname,
                    }
                })
            }
            chat.emit('News.add', userId, `пользователь [id${message.user}|${chat.userNames[message.user].fullName}] установал вам ник "${nickname}"`);
            return message
                .setTitleTemplate(command.messageTemplate.title, chat.userNames[userId].fullName, nickname)
                .send({
                    news: {
                        channel: this.newsChannel,
                        fromUser: message.user,
                    }
                });
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    deleteNickname(chat, message, command) {
        let [, nameOrId] = command.check.args.exec(message.getCommandText());
        let userId = chat.findUser(nameOrId);
        if (!userId) return message.setTitleTemplate(command.messageTemplate.failUser, nameOrId).send();
        return UserNicknameModel.remove({ chatId: chat.id, userId }).exec().then(() => {
            this._deleteNickname(chat, userId);
            if (this.bot.clusterMode && this.bot.clusterMode.isClusterChat(chat.id)) {
                this.bot.clusterMode.send({
                    topic: 'userNicknameDeleteNickname',
                    data: {
                        chatId: chat.id,
                        userId,
                    }
                })
            }
            chat.emit('News.add', userId, `пользователь [id${message.user}|${chat.userNames[message.user].fullName}] удалил ваш ник`);
            return message
                .setTitleTemplate(command.messageTemplate.title, chat.userNames[userId].fullName)
                .send({
                    news: {
                        channel: this.newsChannel,
                        fromUser: message.user,
                    }
                });
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showNicknames(chat, message, command) {
        return UserNicknameModel.find({ chatId: chat.id }).then(nicknames => {
            nicknames = nicknames.filter(doc => chat.users.includes(doc.userId));
            if (!nicknames.length) return message.setTitleTemplate(command.messageTemplate.fail).send();
            return message
                .setTitle(command.messageTemplate.title)
                .setBodyTemplate(
                    command.messageTemplate.body,
                    n => chat.userNames[nicknames[n].userId].fullName,
                    n => nicknames[n].nickname
                )
                .setTemplateLength(nicknames.length)
                .send();
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    addMedal(chat, message, command) {
        let [, nameOrId, medal] = command.check.args.exec(message.getCommandText());
        if (!medal) return;
        let userId = chat.findUser(nameOrId);
        if (!userId) return message.setTitleTemplate(command.messageTemplate.failUser, nameOrId).send();
        return UserMedal.findOneAndUpdate(
            { chatId: chat.id, userId },
            { medal },
            { upsert: true }
        ).exec().then(() => {
            this._addMedal(chat, userId, medal);
            if (this.bot.clusterMode && this.bot.clusterMode.isClusterChat(chat.id)) {
                this.bot.clusterMode.send({
                    topic: 'userNicknameSetMedal',
                    data: {
                        chatId: chat.id,
                        userId,
                        medal,
                    }
                })
            }
            chat.emit('News.add', userId, `пользователь [id${message.user}|${chat.userNames[message.user].fullName}] установил вам медаль ${medal}`);
            return message
                .setTitleTemplate(command.messageTemplate.title, chat.userNames[userId].fullName, medal)
                .send({
                    news: {
                        channel: this.newsChannel,
                        fromUser: message.user,
                    }
                });
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    deleteMedal(chat, message, command) {
        let [, nameOrId] = command.check.args.exec(message.getCommandText());
        let userId = chat.findUser(nameOrId);
        if (!userId) return message.setTitleTemplate(command.messageTemplate.failUser, nameOrId).send();
        return UserMedal.remove({ chatId: chat.id, userId }).exec().then(() => {
            this._deleteMedal(chat, userId);
            if (this.bot.clusterMode && this.bot.clusterMode.isClusterChat(chat.id)) {
                this.bot.clusterMode.send({
                    topic: 'userNicknameDeleteMedal',
                    data: {
                        chatId: chat.id,
                        userId,
                    }
                })
            }
            chat.emit('News.add', userId, `пользователь [id${message.user}|${chat.userNames[message.user].fullName}] удалил вашу медаль`);
            return message
                .setTitleTemplate(command.messageTemplate.title, chat.userNames[userId].fullName)
                .send({
                    news: {
                        channel: this.newsChannel,
                        fromUser: message.user,
                    }
                });
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showMedals(chat, message, command) {
        return UserMedal.find({ chatId: chat.id }).then(medals => {
            medals = medals.filter(doc => chat.users.includes(doc.userId));
            if (!medals.length) return message.setTitleTemplate(command.messageTemplate.fail).send();
            return message
                .setTitle(command.messageTemplate.title)
                .setBodyTemplate(
                    command.messageTemplate.body,
                    n => chat.userNames[medals[n].userId].fullName,
                    n => medals[n].medal
                )
                .setTemplateLength(medals.length)
                .send();
        });
    }

};
