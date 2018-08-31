'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const RulesAndWelcome = require('./RulesAndWelcome');

module.exports = class RulesAndWelcomeModule extends ModuleEventController {

    constructor() {
        super();
        this.chatInviteUsers = {};
        this.chatInviteTimeouts = {};
        this.lastMessage = {};
        this.newsChannel = 'правила'
    }

    /**
     *
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            type: 'chat',
            commandList: {
                name: 'Правила и приветствие',
                description: 'позволяет установить правила и приветствие, показанные новому добавленному в чат пользователю',
            },
            web: {
                icon: {
                    name: 'FaCommenting',
                    options: {
                        color: '#bd6dff',
                    }
                },
            },
            commands: [
                {
                    name: 'showrules',
                    check: ['правила'],
                    commandList: {
                        name: 'правила',
                        usage: 'правила',
                        description: 'показывает установленные в чате правила (если есть)',
                    },
                    messageTemplate: {
                        title: `правила беседы:`,
                        titleBody: `#{0}`,
                        titleFail: `правила в этой беседе не установлены, для установки правил команда "новые правила"`,
                    },
                    web: {},
                },
                {
                    name: 'setrules',
                    check: /^новые правила ?\n?((?:.|\n)*)$/i,
                    commandList: {
                        name: 'установить новые правила',
                        usage: 'новые правила {текст правил}',
                        description: 'новые правила {правила текстом или прикрепленное сообщение с правилами} - устанавливает новые правила, показанные каждому добавленному в чат пользователю',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `правила успешно установлены!`,
                        titleFail: `прикрепите к сообщению с командой сообщение с текстом правил для их установки`,
                        userFail: `пользователю №#{0} нельзя вызвать правила`
                    },
                    vip: {
                        usages: 5,
                    },
                    web: {
                        type: 'action',
                        submitText: 'установить правила',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'showrules',
                                'delrules',
                            ],
                        },
                        filter: (props, chat, message, self) => {
                            return RulesAndWelcome.findOne({chatId: chat.id}).exec()
                                .then(doc => {
                                    let rules = doc && doc.rules || '';
                                    return {
                                        rules: {
                                            type: 'textarea',
                                            data: {
                                                value: rules,
                                                select: true,
                                            },
                                            options: {
                                                rows: 5,
                                            },
                                        }
                                    }
                                });
                        },
                        output: props => `новые правила ${props.rules}`,
                    }
                },
                {
                    name: 'delrules',
                    check: /^удалить правила/i,
                    commandList: {
                        name: 'удалить правила',
                        description: 'удаляет ранее установленные правила',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `правила успешно удалены!`,
                    },
                    web: {
                        type: 'action',
                        submitText: 'удалить правила',
                        hidden: (props, chat) => RulesAndWelcome.findOne({chatId: chat.id}).exec()
                            .then(doc => !doc || !doc.rules),
                        change: {
                            module: this.constructor.name,
                            command: [
                                'showrules',
                                'setrules',
                                'delrules',
                            ],
                        },
                        output: 'удалить правила',
                    }
                },
                {
                    name: 'showwelcome',
                    check: ['приветствие', /\d*/],
                    commandList: {
                        name: 'показать приветствие',
                        usage: 'приветствие',
                        description: 'показывает установленные в чате правила (если есть)',
                    },
                    messageTemplate: {
                        title: `приветствие беседы:`,
                        titleBody: `#{0}`,
                        titleFail: `приветствие в этой беседе не установлено, для установки команда "новое приветствие"`,
                    },
                    web: {},
                },
                {
                    name: 'setwelcome',
                    check: /^новое приветствие ?\n?((?:.|\n)*)$/i,
                    commandList: {
                        name: 'установить новое приветствие',
                        usage: 'новое приветсвие {текст приветствия}',
                        description: 'новое приветствие {приветсвие текстом или прикрепленное сообщение с приветсвием} - устанавливает новое приветствие, показанное каждому добавленному в чат пользователю',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `привествие успешно установлено!`,
                        titleFail: `прикрепите к сообщению с командой сообщение с текстом приветствия для его установки`,
                        userFail: `пользователю №#{0} нельзя вызвать правила`
                    },
                    vip: {
                        usages: 5,
                    },
                    web: {
                        type: 'action',
                        submitText: 'установить приветствие',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'showwelcome',
                                'delwelcome',
                            ],
                        },
                        filter: (props, chat, message, self) => {
                            return RulesAndWelcome.findOne({chatId: chat.id}).exec()
                                .then(doc => {
                                    let welcome = doc && doc.welcome || '';
                                    return {
                                        welcome: {
                                            type: 'textarea',
                                            data: {
                                                value: welcome,
                                                select: true,
                                            },
                                            options: {
                                                rows: 3,
                                            }
                                        }
                                    }
                                });
                        },
                        output: props => `новое приветствие ${props.welcome}`,
                    }
                },
                {
                    name: 'delwelcome',
                    check: /^удалить приветствие/i,
                    commandList: {
                        name: 'удалить приветствие',
                        description: 'удаляет ранее установленное приветствие',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `приветствие успешно удалено!`,
                    },
                    web: {
                        type: 'action',
                        submitText: 'удалить приветствие',
                        hidden: (props, chat) => RulesAndWelcome.findOne({chatId: chat.id}).exec()
                            .then(doc => !doc || !doc.welcome),
                        change: {
                            module: this.constructor.name,
                            command: [
                                'showwelcome',
                                'setwelcome',
                                'delwelcome',
                            ],
                        },
                        output: 'удалить приветствие',
                    }
                },
            ]
        }
    }

    _initChat(chat) {
        this.chatInviteUsers[chat.id] = [];
        return super._initChat(chat).then(() => {
            return chat.after(chat.eventNames['chat.invite'], (info) =>
                // this.runCommand(chat, info, {
                //     name: 'invitation'
                // }), this);
                this.invitation(chat, info, {}), this)
        });
    }

    _finalChat(chat) {
        return super._finalChat(chat).then(() => {
            return chat.removeListenersAfterByHandler(chat.eventNames['chat.invite'], this);
        })
    }

    invitation(chat,info) {
        clearTimeout(this.chatInviteTimeouts[chat.id]);
        if (!this.chatInviteUsers[chat.id].includes(info.invite)) this.chatInviteUsers[chat.id].push(info.invite);
        this.chatInviteTimeouts[chat.id] = setTimeout(() => this.invitationUser(chat), 5e3);
    }

    invitationUser(chat) {
        let users = this.chatInviteUsers[chat.id].filter(info => {
            return (info !== this.bot.selfId
                && !this.bot.additionalAccounts.map(vk => vk.selfId).includes(info))
        });
        this.chatInviteUsers[chat.id] = [];
        if (!users.length) return;
        return RulesAndWelcome.findOne({chatId: chat.id}).exec()
            .then((doc) => {
                if (!doc || !doc.welcome && !doc.rules) return;
                console.log('show rules and welcome in chat', chat.id);
                let message = new this.bot.Message({peer: chat.id});
                if (doc.welcome) {
                    let userNames = users.map(info => {
                        return `[id${info}|${chat.userNames[info].fullName}]`;
                    }).join(', ');
                    if (userNames) {
                        message.setTitle(`${userNames}, ${doc.welcome}\n`);
                    }
                }
                if (doc.rules) {
                    message.setEnd(`правила чата:\n${doc.rules}`);
                }
                if (message.getText()) {
                    if (this.lastMessage[chat.id]) {
                        this.lastMessage[chat.id].delete();
                    }
                    this.lastMessage[chat.id] = message;
                    return message.send();
                }
            });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {Object} command
     */
    showrules(chat, message, command) {
        RulesAndWelcome.findOne({chatId: chat.id}).exec()
            .then((rul) => {
                if (!rul || !rul.rules) {
                    return message.setTitleTemplate(command.messageTemplate.titleFail).send();
                } else {
                    return message.setTitle(command.messageTemplate.title)
                        .setBodyTemplate(command.messageTemplate.titleBody, rul.rules)
                        .send();
                }
            });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {Object} command
     */
    setrules(chat, message, command) {
        let info = command.check.exec(message.getCommandText());
        let isfwd = message.hasFwd();
        if (isfwd || info[1]) {
            let result = Promise.resolve();
            if (isfwd) {
                result = this.bot.vk.api.messages.getById({
                    message_ids: message.id
                }).then((doc) =>{
                    if (doc.items[0].fwd_messages[0]) {
                        return doc.items[0].fwd_messages[0].body;
                    }
                });
            } else if (info[1]) {
                result = Promise.resolve(info[1]);
            }
            return result.then(newrul => {
                if (newrul) {
                    newrul = newrul.replace(/\./g, '');
                    newrul = newrul.replace(/ +/g, ' ');
                    return RulesAndWelcome.findOne({chatId: chat.id})
                        .then((param) => {
                            let result;
                            if (!param) {
                                result = new RulesAndWelcome({
                                    chatId: chat.id,
                                    rules: newrul,
                                }).save();
                            } else {
                                param.rules = newrul;
                                result = param.save();
                            }
                            return result.then(() => {
                                return message
                                    .setTitleTemplate(command.messageTemplate.title, newrul)
                                    .send({
                                        channel: this.newsChannel,
                                        fromUser: message.user,
                                    })
                            });
                        });
                } else {
                    return message.setTitleTemplate(command.messageTemplate.titleFail).send();
                }
            })
        } else {
            return message.setTitleTemplate(command.messageTemplate.titleFail).send();
        }
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {Object} command
     */
    delrules(chat, message, command) {
        RulesAndWelcome.update(
            { chatId: chat.id },
            { rules: '' }
        ).exec()
            .then(() => {
                return message.setTitle(command.messageTemplate.title).send({
                    channel: this.newsChannel,
                    fromUser: message.user,
                });
            })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {Object} command
     */
    showwelcome(chat, message, command) {
        RulesAndWelcome.findOne({chatId: chat.id}).exec()
            .then((rul) => {
                if (!rul || !rul.welcome) {
                    return message.setTitleTemplate(command.messageTemplate.titleFail).send();
                } else {
                    return message.setTitle(command.messageTemplate.title)
                        .setBodyTemplate(command.messageTemplate.titleBody, rul.welcome)
                        .send();
                }
            });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {Object} command
     */
    setwelcome(chat, message, command) {
        let info = command.check.exec(message.getCommandText());
        let isfwd = message.hasFwd();
        if (isfwd || info[1]) {
            let result = Promise.resolve();
            if (isfwd) {
                result = this.bot.vk.api.messages.getById({
                    message_ids: message.id
                }).then((doc) =>{
                    if (doc.items[0].fwd_messages[0]) {
                        return doc.items[0].fwd_messages[0].body;
                    }
                });
            } else if (info[1]) {
                result = Promise.resolve(info[1]);
            }
            return result.then(newwel => {
                if (newwel) {
                    newwel = newwel.replace(/\./g, '');
                    newwel = newwel.replace(/ +/g, ' ');
                    return RulesAndWelcome.findOne({chatId: chat.id})
                        .then((param) => {
                            let result;
                            if (!param) {
                                result = new RulesAndWelcome({
                                    chatId: chat.id,
                                    welcome: newwel,
                                }).save();
                            } else {
                                param.welcome = newwel;
                                result = param.save();
                            }
                            return result.then(() => {
                                return message
                                    .setTitleTemplate(command.messageTemplate.title, newwel)
                                    .send({
                                        channel: this.newsChannel,
                                        fromUser: message.user,
                                    })
                            });
                        });
                } else {
                    return message.setTitleTemplate(command.messageTemplate.titleFail).send();
                }
            })
        } else {
            return message.setTitleTemplate(command.messageTemplate.titleFail).send();
        }
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {Object} command
     */
    delwelcome(chat, message, command) {
        RulesAndWelcome.update(
            { chatId: chat.id },
            { welcome: '' }
        ).exec()
            .then(() => {
                return message.setTitle(command.messageTemplate.title).send({
                    channel: this.newsChannel,
                    fromUser: message.user,
                });
            })
    }
};
