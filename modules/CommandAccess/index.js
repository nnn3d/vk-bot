'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const CoreModuleEventController = require('../../classes/base/CoreModuleEventController');
const Message = require('../../classes/core/Message');
const promiseFactory = require('../../helpers/promiseFactory');
const ChatUserStatus = require('./ChatUserStatus');
const ChatCommandStatus = require('./ChatCommandStatus');
const ChatStatusNames = require('./ChatStatusNames');

module.exports = class CommandAccess extends ModuleEventController {

    /**
     * @typedef {Object} SpecificationCommand_CommandAccess
     * @property {Number} defaultStatus needed status to run this command
     */

    constructor() {
        super();
        this.newsChannel = 'доступ';
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
            web: {
                icon: {
                    name: 'FaShield',
                    options: {
                        color: '#5168ca',
                    }
                },
            },
            commandList: {
                name: 'Доступ',
                description: `позволяет ограничивать использование команд пользователями чата, выдавая доступы командам и статусы участникам
для выполнения команды у участника должен быть статус не меньше доступа команды
изначально у всех статус 0, а у админа беседы - всегда максимальный
у некоторых команд есть стандартные доступы, но их можно изменить`,
                middleware: this._commandListMiddleware,
            },
            commands: [
                {
                    name: 'setUserStatus',
                    check: /^статус ([a-zа-яё]+ ?[a-zа-яё]*|\d+) -? ?(\d|10|[a-zа-яё \-_0-9]*)$/i,
                    commandList: {
                        name: 'изменить статус участника',
                        usage: 'статус (имя пользователя) - (0...9)',
                        description: 'статус (имя [ + фамилия ]) - (статус: число от 0 до 10 или название статуса) - устанавливает статус пользователя в чате',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `пользователю [id#{0}|#{1}] выдан статус #{2}`,
                        titleFail: `недостаточно прав для установки статуса`,
                        userFail: `пользователь #{0} не найден`,
                        statusFail: `статус "#{0}" не найден`,
                        propsFail: `не указаны параметры`,
                    },
                    lists: {
                        listAction: {
                            name: 'статус (номер)',
                            description: 'выдает статус всем участникам списка',
                            check: /^статус (\d|10)$/i,
                            mapUsers: (users, actionName, self) => {
                                let [, status] = self.check.exec(actionName);
                                return users.map(userId => `статус ${userId} ${status}`);
                            }
                        }
                    },
                    web: {
                        type: 'action',
                        change: {
                            module: this.constructor.name,
                            command: 'showUserStatus',
                        },
                        filter: (props, chat, message, self) => {
                            let users;
                            let status;
                            return promiseFactory.allAsync(chat.users.map(userId => {
                                return this._canChangeUserStatus(chat, message.user, userId, 0)
                                    .then(canChange => canChange && userId)
                            })).then(availableUsers => {
                                users = availableUsers.filter(id => id);
                                return this._getUserStatus(chat, message.user);
                            }).then(userStatus => {
                                status = userStatus;
                                if (status === 0) return [];
                                return promiseFactory.allAsync(new Array(status).fill(0).map((el, status) => {
                                    return this._getNameByChatStatus(chat.id, status)
                                        .then(statusName => ({
                                            label: statusName,
                                            value: status,
                                        }));
                                }))
                            }).then(statusesChange => {
                                if (!users.length || !statusesChange.length) return;
                                return {
                                    users: {
                                        type: 'multi',
                                        data: users.map(id => ({
                                            label: chat.userNames[id].fullName,
                                            value: id,
                                        })),
                                        options: {
                                            placeholder: 'участники',
                                        },
                                        clear: true,
                                    },
                                    status: {
                                        type: 'select',
                                        options: {
                                            placeholder: 'статус',
                                        },
                                        data: statusesChange,
                                        clear: true,
                                    },
                                }
                            })
                        },
                        output: (props, chat, message, self) => {
                            if (!props.users.length || isNaN(props.status))
                                return Promise.resolve(self.messageTemplate.propsFail);
                            let result = Promise.resolve();
                            props.users.map(userId => {
                                result = result.then(() => {
                                    message.text = `статус ${userId} - ${props.status}`;
                                    return this[self.name](chat, message, self);
                                });
                            });
                            return result.then(() => message.getResult());
                        },
                    }
                },
                {
                    name: 'showUserStatus',
                    check: /^пока(?:жи|зать) статусы/i,
                    commandList: {
                        name: 'статус участников',
                        usage: 'показать статусы'
                    },
                    messageTemplate: {
                        title: `статусы пользователей:`,
                        body: `#{0} - #{1}`,
                    },
                    web: {
                        type: 'info',
                        output: 'показать статусы',
                    }
                },
                {
                    name: 'setCommandStatus',
                    check: /^доступ команды/i,
                    commandList: {
                        name: 'установить доступ команды',
                        usage: 'доступ команды'
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `команде "#{0}" выдан доступ "#{1}"`,
                        commandChoice: `введи необходимый статус для команды "#{0}" (название или номер от 0 до 10)`,
                        titleFail: `статус "#{0}" не найден`,
                        statusFail: `недостаточно прав для изменения доступа команды`,
                        propsFail: `не указаны параметры`,
                        error: `не удалось изменить статус команды`,
                    },
                    web: {
                        type: 'action',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'showCommandStatus',
                                'deleteCommandStatus',
                            ],
                        },
                        filter: (props, chat, message, self) => {
                            return promiseFactory.allAsync(new Array(11).fill(0).map((el, status) => {
                                return this._getNameByChatStatus(chat.id, status)
                                    .then(statusName => ({
                                        label: statusName,
                                        value: status,
                                    }));
                            })).then(statuses => {
                                let commands = this._getCommandsNames(chat, message);
                                return promiseFactory.allAsync(commands.map(command => {
                                    return this._getCommandStatus(
                                        chat,
                                        command.specification,
                                        command.module.specification.name
                                    ).then(status => command.status = status);
                                }))
                                    .then(() => this._getUserStatus(chat, message.user))
                                    .then(userStatus => {
                                        return {
                                            commands: {
                                                type: 'multi',
                                                options: {
                                                    placeholder: 'команда',
                                                    groupBy: 'group'
                                                },
                                                data: commands
                                                    .filter(command => command.status <= userStatus)
                                                    .map(command => ({
                                                        label: command.name + (command.status && ` (${command.status})` || ''),
                                                        value: {
                                                            commandName: command.specification.name,
                                                            moduleName: command.module.specification.name,
                                                            name: `${command.name}`,
                                                        },
                                                        group: command.moduleName,
                                                    })),
                                                clear: true,
                                            },
                                            status: {
                                                type: 'select',
                                                options: {
                                                    placeholder: 'доступ',
                                                },
                                                data: statuses.filter(status => status.value <= userStatus),
                                                clear: true,
                                            }
                                        }
                                    })
                            })
                        },
                        output: (props, chat, message, self) => {
                            if (!props.commands.length || typeof props.status !== 'number')
                                return Promise.resolve(self.messageTemplate.propsFail);
                            return promiseFactory.allAsync(props.commands.map(command => {
                                return ChatCommandStatus.findOneAndUpdate(
                                    {
                                        chatId: chat.id,
                                        commandName: command.commandName,
                                        moduleName: command.moduleName,
                                    },
                                    { status: props.status },
                                    { upsert:true }
                                ).exec()
                                    .then(() => `команде ${command.name} выдан доступ ${props.status}`)
                                    .catch(() => `не удалось выдать доступ команде ${command.name}`);
                            })).then(result => result.join('<br>'));
                        },
                    },
                },
                {
                    name: 'showCommandStatus',
                    check: /^пока(?:жи|зать) доступы/i,
                    commandList: {
                        name: 'показать доступы команд',
                        usage: 'показать доступы'
                    },
                    messageTemplate: {
                        title: `доступы команд ("название" - необходимый доступ):`,
                        body: `#{0}"#{1}" - #{2}`,
                        titleFail: `ни одной команде еще не выдан доступ`,
                    },
                    web: {},
                },
                {
                    name: 'deleteCommandStatus',
                    check: /^удали(?:ть)? доступ команды/i,
                    commandList: {
                        name: 'удалить доступ команды',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `у команды "#{0}" удален необходимый статус #{1}`,
                        titleFail: `ни одной команде еще не выдан доступ`,
                        statusFail: `недостаточно прав для удаления доступа команды`,
                    }
                },
                {
                    name: 'deleteAllCommandStatus',
                    check: /^удали(?:ть)? все доступы команд/i,
                    commandList: {
                        name: 'удалить все доступы команд',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `все доступы команд удалены`,
                    }
                },
                {
                    name: 'setIgnore',
                    check: /^игнор ([a-zа-яё]+ ?[a-zа-яё]*|\d+)/i,
                    commandList: {
                        name: 'игнор команд пользователя',
                        usage: 'игнор (имя)',
                        description: 'запрещает пользователю выполнять команды бота'
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `команды пользователя [id#{0}|#{1}] теперь игнорируются`,
                        titleFail: `недостаточно прав для добавления в игнор`,
                        userFail: `пользователь #{0} не найден`,
                        propsFail: `не указаны параметры`,
                    },
                    lists: {
                        listAction: {
                            name: 'игнор',
                            description: 'запрещает участникам списка выполнять команды бота',
                            check: /^игнор$/i,
                            mapUsers: (users) => {
                                return users.map(userId => `игнор ${userId}`);
                            }
                        }
                    },
                    web: {
                        type: 'action',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'setIgnore',
                                'showIgnore',
                                'deleteIgnore',
                            ],
                        },
                        submitText: 'добавить в игнор',
                        filter: (props, chat, message, self) => {
                            let users;
                            return ChatUserStatus.find({
                                chatId: chat.id,
                                userId: { $in: chat.users },
                                ignore: true,
                            }).exec()
                                .then(docs => {
                                    let ignoreUsers = docs.map(doc => doc.userId);
                                    let users = chat.users.filter(id => !ignoreUsers.includes(id));
                                    return promiseFactory.allAsync(users.map(userId =>
                                        this._canChangeUserStatus(chat, message.user, userId)
                                            .then(canChange => canChange && userId)
                                    ));
                                })
                                .then(availableUsers => {
                                    users = availableUsers.filter(id => id);
                                    return {
                                        users: {
                                            type: 'multi',
                                            data: users.map(id => ({
                                                label: chat.userNames[id].fullName,
                                                value: id,
                                            })),
                                            options: {
                                                placeholder: 'участники',
                                            },
                                            clear: true,
                                        },
                                    }
                            })
                        },
                        output: (props, chat, message, self) => {
                            if (!props.users.length)
                                return Promise.resolve(self.messageTemplate.propsFail);
                            let result = Promise.resolve();
                            props.users.map(userId => {
                                result = result.then(() => {
                                    message.text = `игнор ${userId}`;
                                    return this[self.name](chat, message, self);
                                });
                            });
                            return result.then(() => message.getResult());
                        },
                    },
                },
                {
                    name: 'showIgnore',
                    check: /^пока(?:жи|зать) игнор/i,
                    commandList: {
                        name: 'показать игнор',
                        description: 'показывает пользователей в игноре'
                    },
                    messageTemplate: {
                        title: `пользователи в игноре:`,
                        body: '• [id#{0}|#{1}]',
                        empty: 'ни одного пользователя нет в игноре',
                    },
                    web: {},
                },
                {
                    name: 'deleteIgnore',
                    check: /^отменит?ь? игнор ([a-zа-яё]+ ?[a-zа-яё]*|\d+)/i,
                    commandList: {
                        name: 'отменить игнор команд пользователя',
                        usage: 'отменить игнор (имя)',
                        description: 'отменяет игнор команд бота'
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `для пользователя [id#{0}|#{1}] отменен игнор`,
                        userFail: `пользователь #{0} не найден`,
                        propsFail: `не указаны параметры`,
                    },
                    web: {
                        type: 'action',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'setIgnore',
                                'showIgnore',
                                'deleteIgnore',
                            ],
                        },
                        submitText: 'отменить игнор',
                        filter: (props, chat, message, self) => {
                            let users;
                            return ChatUserStatus.find({
                                chatId: chat.id,
                                userId: { $in: chat.users },
                                ignore: true,
                            }).exec()
                                .then(docs => {
                                    let ignoreUsers = docs.map(doc => doc.userId);
                                    users = chat.users.filter(id => ignoreUsers.includes(id));
                                    return {
                                        users: {
                                            type: 'multi',
                                            data: users.map(id => ({
                                                label: chat.userNames[id].fullName,
                                                value: id,
                                            })),
                                            options: {
                                                placeholder: 'участники',
                                            },
                                            clear: true,
                                        },
                                    }
                                })
                        },
                        output: (props, chat, message, self) => {
                            if (!props.users.length)
                                return Promise.resolve(self.messageTemplate.propsFail);
                            let result = Promise.resolve();
                            props.users.map(userId => {
                                result = result.then(() => {
                                    message.text = `отменить игнор ${userId}`;
                                    return this[self.name](chat, message, self);
                                });
                            });
                            return result.then(() => message.getResult());
                        },
                    },
                    lists: {
                        listAction: {
                            name: 'отменить игнор',
                            description: 'отменяет игнор команд бота для участников списка',
                            check: /^отменит?ь? игнор$/i,
                            mapUsers: (users, actionName, self) => {
                                return users.map(userId => `отменить игнор ${userId}`);
                            }
                        }
                    },
                },
                {
                    name: 'setStatusName',
                    check: /^название статуса ([a-zа-яё \-_0-9]*) (\d|10)$/i,
                    commandList: {
                        name: 'название статуса',
                        usage: 'название статуса (название) (0...9)',
                        description: 'название статуса ( любое название ) ( номер статуса, от 0 до 10 ) - например, "название статуса админ 9"',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `статусу #{0} присвоено название "#{1}"`,
                        titleFail: `у названия "#{0}" уже есть статус #{1}`,
                    },
                    web: {
                        type: 'action',
                        submitText: 'сохранить',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'showStatusNames',
                                'deleteStatusName',
                            ],
                        },
                        filter: (props, chat, message, self) => {
                            return promiseFactory.allAsync(new Array(11).fill(0).map((el, status) => {
                                return this._getNameByChatStatus(chat.id, status)
                                    .then(statusName => ({
                                        label: statusName,
                                        value: status,
                                    }));
                            })).then(statuses => {
                                return {
                                    status: {
                                        type: 'select',
                                        data: statuses,
                                        clear: true,
                                        options: {
                                            placeholder: 'статус',
                                        },
                                    },
                                    name: {
                                        type: 'text',
                                        data: {
                                            label: '',
                                            value: '',
                                        },
                                        clear: true,
                                        options: {
                                            placeholder: 'название',
                                        },
                                    }
                                }
                            })
                        },
                        output: (props, chat, message, self) => {
                            if (!props.name || typeof props.status !== 'number') return Promise.resolve('Не указаны параметры');
                            return `название статуса ${props.name} ${props.status}`;
                        }
                    }
                },
                {
                    name: 'showStatusNames',
                    check: /^пока(?:жи|зать) названия статусов$/i,
                    commandList: {
                        name: 'показать названия статусов',
                    },
                    messageTemplate: {
                        title: `названия статусов (статус - название):`,
                        titleFail: `ни у одного статуса нет названия`,
                        body: `#{0} - "#{1}"`,
                    },
                    web: {
                        output: 'показать названия статусов',
                    },
                },
                {
                    name: 'deleteStatusName',
                    check: /^удали(?:ть)? название статуса (\d|10)$/i,
                    commandList: {
                        name: 'удалить название статуса',
                        usage: 'удалить название статуса ( 0...9 )'
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `у статуса #{0} удалено название "#{1}"`,
                        titleFail: `у статуса #{0} нет названия`,
                    },
                    web: {
                        type: 'action',
                        submitText: 'удалить',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'showStatusNames',
                                'setStatusName',
                            ],
                        },
                        hidden: (props, chat) => {
                            return promiseFactory.allAsync(new Array(10).fill(0).map((el, status) => {
                                return this._getNameByChatStatus(chat.id, status, true)
                            })).then(statuses => !statuses.length);
                        },
                        filter: (props, chat) => {
                            return promiseFactory.allAsync(new Array(11).fill(0).map((el, status) => {
                                return this._getNameByChatStatus(chat.id, status, true)
                                    .then(statusName => ({
                                        label: statusName,
                                        value: {
                                            status,
                                            statusName,
                                        },
                                        isName: status !== +statusName,
                                    }));
                            })).then(statuses => {
                                return {
                                    status: {
                                        type: 'multi',
                                        data: statuses.filter(status => status.isName),
                                        options: {
                                            placeholder: 'статус',
                                        },
                                        clear: true,
                                    },
                                };
                            })
                        },
                        output: (props, chat, message, self) => {
                            let result = Promise.resolve();
                            if (!props.status.length) return Promise.resolve('Не указаны параметры');
                            props.status.map(status => {
                                message.text = `удалить название статуса ${status.status}`;
                                result = result.then(() => this[self.name](chat, message, self));
                            });
                            return result.then(() => props.status.map(status => {
                                return `У статуса ${status.status} удалено название "${status.statusName}"`;
                            }).join('<br>'));
                        }
                    }
                },
                {
                    name: 'deleteAllStatusNames',
                    check: /^удали(?:ть)? все названия статусов$/i,
                    commandList: {
                        name: 'удалить все названия статусов',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `все названия статусов удалены`,
                    }
                },
            ]
        }
    }

    _init(bot) {
        return super._init(bot)
            .then(() => promiseFactory.allAsync([
                this.global.pre(this.eventNames.runCommand, this._onRunCommand, this),
                CoreModuleEventController.global.pre(this.eventNames.runCommand, this._onRunCommand, this),
                this.bot.after('createVkChat', this._onCreateVkChat, this),
                this.bot.middlewareOn('Web.getCommandList', this._webCommandList, this),
                this.bot.middlewareOn('CommandList.getUserInfo', this._getUserInfo, this),
                this.bot.pre('Utils.fuzzySearch', this._utilsFuzzySearch, this),
                this.bot.middlewareOn('Lists.getAutoLists', this._getAutoLists, this),
            ]));
    }

    _final() {
        return super._final()
            .then(() => promiseFactory.allAsync([
                this.global.removeListenersOnByHandler(this.eventNames.runCommand, this),
                CoreModuleEventController.global.removeListenersOnByHandler(this.eventNames.runCommand, this),
                this.bot.removeListenersAfterByHandler('createVkChat', this),
                this.bot.removeMiddlewareOnByHandler('Web.getCommandList', this),
                this.bot.removeMiddlewareOnByHandler('CommandList.getUserInfo', this),
                this.bot.removeListenersPreByHandler('Utils.fuzzySearch', this),
                this.bot.removeMiddlewareOnByHandler('Lists.getAutoLists', this),
            ]));
    }

    _finalChat(chat) {
        return super._finalChat(chat).then(() => {
            return chat.removeListenersOnByHandler(chat.eventNames['chat.kick'], this)
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Number} userId
     * @param {Object} info
     * @private
     */
    _getUserInfo([chat, userId, info]) {
        if (!chat.modules.includes(this)) return;
        return this._getUserStatus(chat, userId)
            .then(status => this._getNameByChatStatus(chat.id, status))
            .then(statusName => info.push(`статус: ${statusName}`));
    }

    _utilsFuzzySearch(chat, message) {
        return ChatUserStatus.findOne({ chatId: chat.id, userId: message.user }).exec()
            .then(doc => {
                if (doc && doc.ignore) throw `user ${message.user} in chat ${chat.id} is ignored`;
            });
    }

    _getAutoLists([chat, lists]) {
        if (!chat.modules.includes(this)) return;
        let getStatusUsers = (chat, actionName, self) => {
            let [, direction, status] = self.check.exec(actionName);
            let compare;
            switch (direction) {
                case 'больше': compare = (userStatus, actionStatus) => userStatus > actionStatus; break;
                case 'меньше': compare = (userStatus, actionStatus) => userStatus < actionStatus; break;
                default: compare = (userStatus, actionStatus) => userStatus === actionStatus;
            }
            let users = chat.users.slice();
            return promiseFactory
                .allAsync(users.map(userId => this._getUserStatus(chat, userId)))
                .then(statuses => {
                    return users.filter((id, i) => compare(statuses[i], +status));
                })
        };
        /**
         * @type {Array<SpecificationCommand_Lists_autoList>}
         */
        let autoLists = [
            {
                name: 'статус ("больше" или "меньше" или "равен") (номер)',
                description: 'создает список из участников, имеющих больший, меньший, или равный заданному статус',
                check: /^статус (больше|меньше|равен) (\d|10)$/,
                getUsers: getStatusUsers,
            },
            {
                name: 'игнор',
                description: 'создает список из участников, команды которых игнорируются',
                check: /^игнор$/,
                getUsers: (chat) => ChatUserStatus.find({
                    chatId: chat.id,
                    userId: { $in: chat.users },
                    ignore: true,
                }).then(docs => docs.map(doc => doc.userId)),
            },
        ]
        return [chat, lists.concat(autoLists)];
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     * @param {ModuleEventController} module
     */
    _onRunCommand(chat, message, command, module) {
        if (!chat.modules.includes(this)) return;
        let result = Promise.resolve();
        let neededStatus;
        let userDoc;
        return result
            .then(() => {
                return ChatCommandStatus.findOne({
                    chatId: chat.id,
                    moduleName: module.specification.name,
                    commandName: command.name,
                }).exec()
            })
            .then(doc => {
                neededStatus = (doc && doc.status) || (!doc && command.commandAccess && +command.commandAccess.defaultStatus) || 0;
                return ChatUserStatus.findOne({chatId: chat.id, userId: message.user})
                    .exec()
                    .then(doc => {
                        if (doc && doc.ignore) {
                            throw `the user ${message.user} is ignored (chat ${chat.id})`;
                        }
                        return this._getUserStatus(chat, message.user, doc && doc.status || 0);
                    })
            })
            .then(userStatus => {
                if (userStatus < neededStatus) {
                    return message.createReply().setBody(`Недостаточный статус (${userStatus} < ${neededStatus}) для выполнения этой команды!`).send()
                        .then(() => {
                            throw `the user ${message.user} status  (${userStatus}) is less than necessary (${neededStatus}) (chat ${chat.id})`;
                        })
                }
            })
    }

    _onCreateVkChat(userIds, chatId) {
        // if (isNaN(chatId)) return;
        // let users = userIds.slice()
        //     .filter(userId => {
        //         return ![this.bot.selfId].concat(this.bot.additionalAccounts.map(vk => vk.selfId)).includes(userId);
        //     });
        // let promises = [];
        // for (let userId of users) {
        //     promises.push(ChatUserStatus.findOneAndUpdate(
        //         { chatId, userId },
        //         { status: 10 },
        //         { upsert: true }
        //     ).exec());
        // }
        // return promiseFactory.allAsync(promises);
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {Array<Specification>} commandList
     * @returns {Promise<Array>}
     * @private
     */
    _webCommandList([chat, message, commandList]) {
        if (!chat.modules.includes(this)) return Promise.resolve([chat, message, commandList]);
        let result = Promise.resolve();
        let userStatus;
        return result.then(() => this._getUserStatus(chat, message.user))
            .then(status => {
                userStatus = status;
                return ChatCommandStatus.find({ chatId: chat.id }).exec();
            })
            .then(commandStatuses => {
                commandList.map(moduleSpec => {
                    moduleSpec.commands = moduleSpec.commands.filter(command => {
                        let neededStatus = command.commandAccess && command.commandAccess.defaultStatus || 0;
                        commandStatuses.map(commandStatus => {
                            if (commandStatus.moduleName === moduleSpec.name
                                && commandStatus.commandName === command.name) {
                                neededStatus = commandStatus.status;
                            }
                        });
                        return userStatus >= neededStatus;
                    });
                });
                return Promise.resolve([chat, message, commandList]);
            })
    }


    /**
     *
     * @param {Specification} specification
     * @param {Chat} chat
     * @returns {Promise<Specification>}
     * @private
     */
    _commandListMiddleware(specification, chat) {
        return ChatCommandStatus.find({chatId: chat.id, moduleName: specification.name}).exec()
            .then(docs => {
                let result = Promise.resolve();
                for (let command of specification.commands) {
                    let status;
                    if (command.commandAccess && command.commandAccess.defaultStatus)
                        status = command.commandAccess.defaultStatus;
                    for (let doc of docs) {
                        if (command.name === doc.commandName) {
                            status = doc.status;
                        }
                    }
                    if (status) {
                        result = result
                            .then(() => {
                                if (!command.commandList.usage)
                                    command.commandList.usage = command.commandList.name || '';
                                command.commandList.usage += ` *дстп ${status}*`;
                            })
                    }
                }
                return result;
            })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @return {Array<{specification: SpecificationCommand, module: ModuleEventController, name: String, moduleName: String}>}
     * @private
     */
    _getCommandsNames(chat, message) {
        let commands = [];
        for (let module of chat.modules) {
            for (let command of module.specification.commands) {
                if (!this.validateCommand(chat, message, command.check, false)) continue;
                let commandInfo = {};
                commandInfo.specification = command;
                commandInfo.module = module;
                commandInfo.name = (command.commandList && command.commandList.name)
                    || command.name || (command.execute && command.execute.name);
                commandInfo.moduleName = (module.specification.commandList && module.specification.commandList.name)
                    || module.specification.name;
                commands.push(commandInfo);
            }
        }
        return commands;
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {Array<{specification: SpecificationCommand, module: ModuleEventController, name: String, moduleName: String}>} commands
     * @return {Promise<{specification: SpecificationCommand, module: ModuleEventController, name: String, moduleName: String}|null>}
     * @private
     */
    _getCommandNameFromMenu(chat, message, commands) {
        return new Promise((resolve, reject) => {
            let getAnswer = answerMessage => {
                if (message.user !== answerMessage.user) return;
                return chat.removeListenerOn(chat.eventNames.message, getAnswer).then(() => {
                    let find = /^\D*(\d+)/i.exec(answerMessage.getCommandText()) || [];
                    let num = find[1];
                    if (!num || isNaN(num) || !commands[num-1]) resolve(null);
                    resolve(commands[num-1]);
                });
            };
            setTimeout(() => {
                chat.removeListenerOn(chat.eventNames.message, getAnswer);
                resolve(null);
            }, 60000);
            let lastModule;
            let tempFun = n => {
                let text = `${n+1}`;
                if (lastModule !== commands[n].moduleName) {
                    lastModule = commands[n].moduleName;
                    text = `▼ раздел ${commands[n].moduleName}\n${text}`;
                }
                return text;
            };
            return promiseFactory.allAsync(commands.map(command => {
                return this._getCommandStatus(
                    chat,
                    command.specification,
                    command.module.specification.name
                ).then(status => status && (command.statusName = `(${status})`));
            })).then(() => {
                return message.new.createReply().setTitle('Введи номер команды для продолжения')
                    .setBodyTemplate('#{0}. #{1} #{2}',
                        tempFun,
                        n => commands[n].name,
                        n => commands[n].statusName || '')
                    .setTemplateLength(commands.length)
                    .send()
                    .then(() => chat.on(chat.eventNames.message, getAnswer, this));
            })
        })
    }

    /**
     *
     * @param {String|Number} chatId
     * @param {String|Number} name
     * @returns {Promise<Number>}
     * @private
     */
    _getChatStatusByName(chatId, name) {
        if (!(typeof name === 'string' || typeof name === 'number')) return Promise.resolve(null);
        if (+(name.toString()) === +name && name <= 10 && name >= 0) return Promise.resolve(+name);
        return ChatStatusNames.findOne({chatId, name: new RegExp(name, 'i')}).exec().then((doc) => {
            if (!doc) return null;
            return doc.status;
        })
    }

    /**
     *
     * @param {String|Number} chatId
     * @param {Number} status
     * @param {Boolean} onlyData
     * @returns {Promise<String>}
     * @private
     */
    _getNameByChatStatus(chatId, status, onlyData = false) {
        return ChatStatusNames.findOne({chatId, status}).exec().then((doc) => {
            if (!doc) {
                status = Math.min(10, Math.abs(+status));
                if (!onlyData) {
                    if (status === 10) return `"Админ" (${status})`;
                    if (status === 0) return `"Нет статуса" (${status})`;
                }
                return status;
            }
            return `"${doc.name}" (${status})`;
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {String|Number} nameOrId
     * @param {Number} [status]
     * @return {Promise.<Number>}
     * @private
     */
    _getUserStatus(chat, nameOrId, status = null) {
        let result = Promise.resolve();
        return result.then(() => {
            if (chat.disabled) return 0;
            if (this.bot.selfId === nameOrId) return 11;
            let userId = chat.findUser(nameOrId);
            if (!userId) {
                if (typeof nameOrId === 'number') userId = nameOrId;
                else if (typeof status === 'number') return status;
                else return 0;
            }
            if (chat.adminsId.includes(userId) || this.bot.admins.includes(userId))
                return 10;
            if (typeof status === 'number') return status;
            return ChatUserStatus.findOne({ chatId: chat.id, userId }).exec()
                .then(user => {
                    return user && user.status || 0;
                });
        })
    }

    _getCommandStatus(chat, command, moduleName) {
        if (chat.disabled) {
            return command.commandAccess && command.commandAccess.defaultStatus || 0
        }
        return ChatCommandStatus.findOne({ chatId: chat.id, commandName: command.name, moduleName })
            .exec()
            .then(doc => {
                let status;
                if (doc) status = doc.status;
                else if (command.commandAccess && command.commandAccess.defaultStatus) {
                    status = command.commandAccess.defaultStatus;
                }
                return status || 0;
            });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Number|String} fromUser
     * @param {Number|String} toUser
     * @param {Number|String} status
     * @return {Promise.<Boolean>}
     * @private
     */
    _canChangeUserStatus(chat, fromUser, toUser, status = 0) {
        return this._getUserStatus(chat, fromUser).then(fromUserStatus => {
            if (fromUserStatus <= status) return false;
            return this._getUserStatus(chat, toUser).then(toUserStatus => {
                return fromUserStatus > toUserStatus;
            })
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    setUserStatus(chat, message, command) {
        let info = command.check.exec(message.getCommandText());
        let nameOrId = info[1];
        let nameOrStatus = info[2];
        return this._getChatStatusByName(chat.id, nameOrStatus)
            .then((status) => {
                if (status === null)
                    return message.setTitleTemplate(command.messageTemplate.statusFail, nameOrStatus).send();
                let userId = chat.findUser(nameOrId);
                return this._canChangeUserStatus(chat, message.user, userId, status)
                .then(canChange => {
                    if (!canChange)
                        return message.setTitleTemplate(command.messageTemplate.titleFail).send();
                    if (!userId) return message.setTitleTemplate(command.messageTemplate.userFail, nameOrId).send();
                    return ChatUserStatus.findOneAndUpdate(
                        {chatId: chat.id, userId},
                        { status },
                        { upsert: true }
                    ).then(() => {
                        chat.emit('News.add', userId, `пользователь [id${message.user}|${chat.userNames[message.user].fullName}] выдал вам статус ${status}`);
                        return message
                            .setTitleTemplate(
                                command.messageTemplate.title,
                                userId,
                                chat.userNames[userId].fullName,
                                status
                            )
                            .send({
                                news: {
                                    channel: this.newsChannel,
                                    fromUser: message.user,
                                }
                            })
                    })
                });
            });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showUserStatus(chat, message, command) {
        let users = chat.users.slice().map(id => ({ id }));
        return promiseFactory.allAsync([
            promiseFactory.allAsync(new Array(11).fill(0).map((e, i) => this._getNameByChatStatus(chat.id, i))),
            promiseFactory.allAsync(users.map(user => this._getUserStatus(chat, user.id))),
        ]).then(([statusNames, statuses]) => {
            users.map((user, i) => {
                user.status = statuses[i];
            });
            users = users.filter(user => user.status);
            users.sort((a, b) => b.status - a.status);
            return message.setTitleTemplate(command.messageTemplate.title)
                .setBodyTemplate(
                    command.messageTemplate.body,
                    n => `${chat.userNames[users[n].id].fullName}`,
                    n => statusNames[users[n].status])
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
    setCommandStatus(chat, message, command) {
        let commands = this._getCommandsNames(chat, message);
        this._getCommandNameFromMenu(chat, message, commands)
            .then(commandInfo => {
                if (commandInfo === null) return;
                let getAnswer = answerMessage => {
                    if (message.user !== answerMessage.user) return;
                    return chat.removeListenerOn(chat.eventNames.message, getAnswer)
                        .then(() => (
                            promiseFactory.allAsync([
                                this._getCommandStatus(chat, commandInfo.specification, commandInfo.module.specification.name),
                                this._getChatStatusByName(chat.id, answerMessage.text),
                                this._getUserStatus(chat, answerMessage.user),
                            ])
                        ))
                        .then(([commandStatus, status, userStatus]) => {
                            if (status === null) {
                                return answerMessage
                                    .setTitleTemplate(command.messageTemplate.titleFail, answerMessage.text)
                                    .send();
                            }
                            if (userStatus < status || userStatus < commandStatus)
                                return answerMessage
                                    .setTitleTemplate(command.messageTemplate.statusFail)
                                    .send();

                            return ChatCommandStatus.findOneAndUpdate({
                                chatId: chat.id,
                                moduleName: commandInfo.module.specification.name,
                                commandName: commandInfo.specification.name,
                            }, { status }, { upsert: true })
                                .then(() => {
                                    return answerMessage
                                        .setTitleTemplate(
                                            command.messageTemplate.title,
                                            commandInfo.name,
                                            answerMessage.text
                                        ).send({
                                            news: {
                                                channel: this.newsChannel,
                                                fromUser: message.user,
                                            }
                                        });
                                })
                        });
                };
                setTimeout(() => {
                    chat.removeListenerOn(chat.eventNames.message, getAnswer);
                }, 60000);
                return message.new.setTitleTemplate(command.messageTemplate.commandChoice, commandInfo.name).send()
                    .then(() => chat.on(chat.eventNames.message, getAnswer, this));
            })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showCommandStatus(chat, message, command) {
        return ChatCommandStatus.find({chatId: chat.id}).exec()
            .then(docs => {
                let commands = this._getCommandsNames(chat, message);
                let statusCommands = [];
                let result = Promise.resolve();
                for (let command of commands) {
                    for (let doc of docs) {
                        if (command.module.specification.name === doc.moduleName
                        && command.specification.name === doc.commandName) {
                            statusCommands.push(command);
                            result = result.then(() => this._getNameByChatStatus(chat.id, doc.status))
                                .then(statusName => {
                                    command.statusName = statusName;
                                });
                        }
                    }
                    if (command.specification.commandAccess && command.specification.commandAccess.defaultStatus
                        && !statusCommands.includes(command)) {
                        statusCommands.push(command);
                        result = result
                            .then(() => this._getNameByChatStatus(chat.id, command.specification.commandAccess.defaultStatus))
                            .then(statusName => {
                                command.statusName = `${statusName} *стандартный*`;
                            });
                    }
                }
                return result.then(() => {
                    if (!statusCommands.length) return message.setTitleTemplate(command.messageTemplate.titleFail).send();
                    let lastModule = '';
                    return message.setTitleTemplate(command.messageTemplate.title)
                        .setBodyTemplate(command.messageTemplate.body,
                            n => {
                                if (statusCommands[n].moduleName !== lastModule) {
                                    lastModule = statusCommands[n].moduleName;
                                    return `▼ раздел ${statusCommands[n].moduleName}\n`;
                                }
                                return '';
                            },
                            n => statusCommands[n].name,
                            n => statusCommands[n].statusName)
                        .setTemplateLength(statusCommands.length)
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
    deleteCommandStatus(chat, message, command) {
        return ChatCommandStatus.find({chatId: chat.id}).exec()
            .then((docs) => {
                let commands = this._getCommandsNames(chat, message);
                let statusCommands = [];
                let result = Promise.resolve();
                for (let doc of docs) {
                    for (let command of commands) {
                        if (command.module.specification.name === doc.moduleName
                            && command.specification.name === doc.commandName) {
                            result = result.then(() => this._getNameByChatStatus(chat.id, doc.status))
                                .then(statusName => {
                                    command.statusName = statusName;
                                });
                            statusCommands.push(command);
                        }
                    }
                }
                if (!statusCommands.length) return message.setTitleTemplate(command.messageTemplate.titleFail).send();
                return promiseFactory.allAsync([
                        this._getCommandNameFromMenu(chat, message, statusCommands),
                        this._getUserStatus(chat, message.user),
                    ])
                    .then(([comm, userStatus]) => {
                        if (comm === null) return;
                        return this._getCommandStatus(chat, comm.specification, comm.module.specification.name)
                            .then(commandStatus => {
                                if (userStatus < commandStatus)
                                    return message.new
                                        .setTitleTemplate(command.messageTemplate.statusFail)
                                        .send();
                                return ChatCommandStatus.remove({
                                    chatId: chat.id,
                                    moduleName: comm.module.specification.name,
                                    commandName: comm.specification.name
                                }).exec()
                                    .then(() => {
                                        return message.new.setTitleTemplate(
                                            command.messageTemplate.title,
                                            comm.name,
                                            comm.statusName)
                                            .send({
                                                news: {
                                                    channel: this.newsChannel,
                                                    fromUser: message.user,
                                                }
                                            })
                                    })
                            })
                    })

            })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    deleteAllCommandStatus(chat, message, command) {
        return ChatCommandStatus.remove({chatId: chat.id}).exec()
            .then(() => {
                return message.setTitleTemplate(command.messageTemplate.title).send({
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
    setIgnore(chat, message, command) {
        let info = command.check.exec(message.getCommandText());
        let nameOrId = info[1];
        let userId = chat.findUser(nameOrId);
        if (!userId) return message.setTitleTemplate(command.messageTemplate.userFail, nameOrId).send();
        return this._canChangeUserStatus(chat, message.user, userId)
            .then(canChange => {
                if (!canChange)
                    return message.setTitleTemplate(command.messageTemplate.titleFail).send();
                return ChatUserStatus.findOneAndUpdate(
                    { chatId: chat.id, userId },
                    { ignore: true },
                    { upsert: true }
                ).then(() => {
                    chat.emit('News.add', userId, `пользователь [id${message.user}|${chat.userNames[message.user].fullName}] добавил вас в игнор бота`);
                    return message
                        .setTitleTemplate(
                            command.messageTemplate.title,
                            userId,
                            chat.userNames[userId].fullName
                        )
                        .send({
                            news: {
                                channel: this.newsChannel,
                                fromUser: message.user,
                            }
                        })
                })
            });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showIgnore(chat, message, command) {
        return ChatUserStatus.find({
            chatId: chat.id,
            userId: { $in: chat.users },
            ignore: true,
        }).then(docs => {
            if (!docs.length) return message.setTitle(command.messageTemplate.empty).send();
            return message.setTitle(command.messageTemplate.title)
                .setBodyTemplate(
                    command.messageTemplate.body,
                    i => docs[i].userId,
                    i => chat.userNames[docs[i].userId].fullName
                )
                .setTemplateLength(docs.length)
                .send()
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    deleteIgnore(chat, message, command) {
        let info = command.check.exec(message.getCommandText());
        let nameOrId = info[1];
        let userId = chat.findUser(nameOrId);
        if (!userId) return message.setTitleTemplate(command.messageTemplate.userFail, nameOrId).send();
        return ChatUserStatus.findOneAndUpdate(
            { chatId: chat.id, userId },
            { ignore: false },
            { upsert: true }
        ).then(() => {
            chat.emit('News.add', userId, `пользователь [id${message.user}|${chat.userNames[message.user].fullName}] удалил вас из игнора бота`);
            return message
                .setTitleTemplate(
                    command.messageTemplate.title,
                    userId,
                    chat.userNames[userId].fullName
                )
                .send({
                    news: {
                        channel: this.newsChannel,
                        fromUser: message.user,
                    }
                })
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    setStatusName(chat, message, command) {
        let info = command.check.exec(message.getCommandText());
        let name = info[1];
        let status = Math.abs(info[2]);
        return ChatStatusNames.findOne({chatId: chat.id, name}).exec()
            .then((doc) => {
                if (doc) return message.setTitleTemplate(command.messageTemplate.titleFail, name, doc.status).send()
               return ChatStatusNames.findOne({chatId: chat.id, status}).exec()
                   .then((doc) => {
                       if (!doc) {
                           return new ChatStatusNames({
                               chatId: chat.id,
                               status,
                               name
                           }).save();
                       }
                       doc.name = name;
                       return doc.save();
                   }).then(() => {
                       return message
                           .setTitleTemplate(command.messageTemplate.title, status, name)
                           .send({
                               news: {
                                   channel: this.newsChannel,
                                   fromUser: message.user,
                               }
                           })
                   });
            });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    deleteStatusName(chat, message, command) {
        let info = command.check.exec(message.getCommandText());
        let status = info[1];
        return ChatStatusNames.findOne({chatId: chat.id, status}).exec()
            .then((doc) => {
                if (!doc) return message.setTitleTemplate(command.messageTemplate.titleFail, status).send();
                let name = doc.name;
                return doc.remove().then(() => {
                    return message
                        .setTitleTemplate(command.messageTemplate.title, status, name)
                        .send({
                            news: {
                                channel: this.newsChannel,
                                fromUser: message.user,
                            }
                        })
                });
            });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    deleteAllStatusNames(chat, message, command) {
        return ChatStatusNames.remove({chatId: chat.id}).exec()
            .then(() => {
                return message
                    .setTitleTemplate(command.messageTemplate.title)
                    .send({
                        news: {
                            channel: this.newsChannel,
                            fromUser: message.user,
                        }
                    })
            })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showStatusNames(chat, message, command) {
        return ChatStatusNames.find({chatId: chat.id}).sort('status').exec()
            .then((docs) => {
                if (!docs.length) return message.setTitleTemplate(command.messageTemplate.titleFail).send();
                return message.setTitleTemplate(command.messageTemplate.title)
                    .setBodyTemplate(command.messageTemplate.body, n => docs[n].status, n => docs[n].name)
                    .setTemplateLength(docs.length)
                    .send();
            })
    }

};
