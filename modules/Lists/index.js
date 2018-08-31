'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const NotesList = require('./NotesList');

module.exports = class Lists extends ModuleEventController {

    /**
     * @typedef {Object} SpecificationCommand_Lists
     * @property {SpecificationCommand_Lists_listAction} [listAction]
     *
     */

    /**
     * @typedef {Object} SpecificationCommand_Lists_listAction
     * @property {String} name
     * @property {String} [description]
     * @property {RegExp} check
     * @property {Boolean} withoutHeader
     * @property {function(userIds:Array,actionName:String,action:SpecificationCommand_Lists_listAction): Array<String>} mapUsers
     *
     */

    /**
     * @typedef {Object} SpecificationCommand_Lists_autoList
     * @property {String} name
     * @property {String} [description]
     * @property {RegExp} check
     * @property {(function(chat:Chat,name:String,list:SpecificationCommand_Lists_autoList): Promise<Array<Number>>|Array<Number>)} getUsers
     * @property {(function(chat:Chat,list:SpecificationCommand_Lists_autoList): Promise<Array<Number>>|Array<Number>)} [getUsersCount]
     *
     */

    constructor(options) {
        super();
        this.options = {
            maxChatLists: 10,
        };
        this.options = Object.assign(this.options, options);
        this.newsChannel = 'списки';
    }


    /**
     *
     * @return {Specification}
     */
    moduleSpecification() {
        return {
            type: 'chat',
            commandList: {
                name: 'Списки',
                description: 'Позволяет составлять списки и автосписки, и выполнять с ними действия',
            },
            web: {
                icon: {
                    name: 'GoListUnordered',
                    options: {
                        color: '#ff7160',
                    }
                },
            },
            commands: [
                {
                    name: 'addToList',
                    check: {
                        args: /^список ([\w\dа-яё]+) добави?т?ь? ?([\w\dа-яё\- ]+)?$/i,
                    },
                    commandList: {
                        name: 'добавить участника в список',
                        usage: 'список (название - одно слово) добавить {имя}{ - имя}{...}',
                        description: 'добавляет одного или нескольких новых участников в список, можно переслать сообщения с необходимыми участниками вместе с командой',
                    },
                    vip: {
                        usages: 10,
                    },
                    messageTemplate: {
                        title: '#{0} успешно добавлен в список "#{1}"',
                        fail: 'невозможно создать список - не может быть больше #{0} списков в чате!',
                        failUser: 'впишите имя участника в команду или перешлите сообщения вместе с ней для добавления в список',
                        failProps: 'не заданы параметры',
                        webUsers: 'выберите участников для добавления',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    web: {
                        type: 'action',
                        submitText: (props) => props && props.name ? `добавить в список ${props.name}` : 'выбрать участников',
                        change: props => {
                            let change = {
                                module: this.constructor.name,
                                command: [
                                    'addToList',
                                ],
                            };
                            if (props && props.users) {
                                change.command.push('deleteFromList', 'showList', 'showLists', 'deleteList');
                            }
                            return change;
                        },
                        filter: (props, chat) => {
                            return NotesList.find({ chatId: chat.id }).exec().then(docs => {
                                let filter = {
                                    name: {
                                        type: 'combo',
                                        data: docs.map(doc => ({
                                            label: doc.name,
                                            value: doc.name,
                                        })),
                                        options: {
                                            placeholder: 'название списка',
                                            disabled: props && props.name && !props.users,
                                            suggest: true,
                                        },
                                        clear: props && props.users,
                                    },
                                };
                                if (props && props.name && !props.users) {
                                    return this._findList(chat, props.name, true).then(list => {
                                        let users = list
                                            ? chat.users.filter(userId => !list.userId.includes(userId))
                                            : chat.users;
                                        filter.users = {
                                            type: 'multi',
                                            options: {
                                                placeholder: 'участники',
                                            },
                                            data: users.map((userId) => ({
                                                label: chat.userNames[userId].fullName,
                                                value: userId,
                                            })),
                                        };
                                        return filter;
                                    })
                                } else return filter;
                            })
                        },
                        output: (props, chat, message, self) => {
                            if (!props) return message.setTitle(self.messageTemplate.failProps).send();
                            if (props.name) {
                                if (props.users) return `список ${props.name} добавить ${props.users.join(' - ')}`;
                                else return message.setTitle(self.messageTemplate.webUsers).send();
                            }
                        },
                    },
                    lists: {
                        listAction: {
                            name: 'добавить в список (название списка)',
                            description: 'добавляет участников списка в список',
                            check: /^добавить в список ([\w\dа-яё]+)/i,
                            mapUsers: (users, actionName, self) => {
                                let [, list]= self.check.exec(actionName);
                                return `список ${list} добавить ${users.join('-')}`;
                            }
                        }
                    },
                },
                {
                    name: 'deleteFromList',
                    check: {
                        args: /^список ([\w\dа-яё]+) удалит?ь? ?([\w\dа-яё\- ]+)?$/i,
                    },
                    commandList: {
                        name: 'удалить участника из списка',
                        usage: 'список (название - одно слово) удалить {имя}{ - имя}{...}',
                        description: 'удаляет участника из списка, вместо имени можно переслать сообщения с необходимыми участниками вместе с командой',
                    },
                    vip: {
                        usages: 10,
                    },
                    messageTemplate: {
                        title: '#{0} успешно удален из списка "#{1}"',
                        failList: 'не найден список "#{0}"!',
                        failUser: 'впишите имя участника в команду или перешлите сообщения вместе с ней для удаления из списка',
                        failListUser: 'в списке "#{0}" нет таких участников!',
                        failProps: 'не заданы параметры',
                        webUsers: 'выберите участников для удаления',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    web: {
                        type: 'action',
                        submitText: (props) => props && props.name ? `удалить из списка ${props.name}` : 'выбрать участников',
                        change: props => {
                            let change = {
                                module: this.constructor.name,
                                command: [
                                    'deleteFromList',
                                ],
                            };
                            if (props && props.users) {
                                change.command.push('addToList', 'showList', 'showLists', 'deleteList');
                            }
                            return change;
                        },
                        filter: (props, chat) => {
                            return NotesList.find({ chatId: chat.id }).exec().then(docs => {
                                let filter = {
                                    name: {
                                        type: 'select',
                                        data: docs.map(doc => ({
                                            label: doc.name,
                                            value: doc.name,
                                        })),
                                        options: {
                                            placeholder: 'название списка',
                                            disabled: props && props.name && !props.users,
                                            suggest: true,
                                        },
                                        clear: props && props.users,
                                    },
                                };
                                if (props && props.name && !props.users) {
                                    return this._findList(chat, props.name, true).then(list => {
                                        if (!list) return filter;
                                        let users = chat.users.filter(userId => list.userId.includes(userId))
                                        filter.users = {
                                            type: 'multi',
                                            options: {
                                                placeholder: 'участники',
                                            },
                                            data: users.map((userId) => ({
                                                label: chat.userNames[userId].fullName,
                                                value: userId,
                                            })),
                                        };
                                        return filter;
                                    })
                                } else return filter;
                            })
                        },
                        output: (props, chat, message, self) => {
                            if (!props) return message.setTitle(self.messageTemplate.failProps).send();
                            if (props.name) {
                                if (props.users) return `список ${props.name} удалить ${props.users.join(' - ')}`;
                                else return message.setTitle(self.messageTemplate.webUsers).send();
                            }
                        },
                    },
                    lists: {
                        listAction: {
                            name: 'удалить из списка (название списка)',
                            description: 'удаляет участников списка из списка (если есть)',
                            check: /^удалить из списка ([\w\dа-яё]+)/i,
                            mapUsers: (users, actionName, self) => {
                                let [, list]= self.check.exec(actionName);
                                return `список ${list} удалить ${users.join('-')}`;
                            },
                        }
                    },
                },
                {
                    name: 'pingList',
                    check: {
                        // args: /^поз(?:вать|ови) (авто)?список ([\w\dа-яё]+) ((?:.|\n)+)$/i,
                        args: /^позвать ([\w\dа-яё\- ]+) текст ((?:.|\n)+)$/i,
                    },
                    commandList: {
                        name: 'позвать список',
                        usage: 'позвать {авто}список (название) (текст)',
                        description: 'зовет всех участников списка или автосписка, чтобы каждый увидел сообщение',
                        hidden: true,
                    },
                    vip: {
                        usages: 10,
                    },
                    messageTemplate: {
                        title: '#{0}, #{1}',
                        failUsers: 'не найден ни один участник!',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    lists: {
                        listAction: {
                            name: 'позвать (текст)',
                            description: 'зовет всех участников списка, чтобы каждый увидел сообщение',
                            check: /^позвать (.+)/i,
                            withoutHeader: true,
                            mapUsers: (users, actionName, self) => {
                                let [, text] = self.check.exec(actionName);
                                return `позвать ${users.join('-')} текст ${text}`;
                            }
                        }
                    },
                    // web: {
                    //     type: 'action',
                    //     submitText: 'добавить заметку',
                    //
                    // },
                },
                {
                    name: 'commandWithList',
                    check: {
                        args: /^(авто)?список (([\w\dа-яё]+)[\w\dа-яё ]*?) команд.? (.+)$/i,
                    },
                    commandList: {
                        name: 'команда со списком',
                        usage: '{авто}список (название) команда (команда бота)',
                        description: 'выполняет любую команду бота со списком или автосписком, например "список админы команда топ 7" выполнит команду "топ 7" только для списка админов',
                    },
                    vip: {
                        usages: 8,
                    },
                    messageTemplate: {
                        title: 'результат команды "#{0}" для списка "#{1}":\n#{2}',
                        failList: 'не найден список "#{0}"!',
                        failUsers: 'список "#{0}" пуст!',
                        failCommand: 'не найдена команда "#{0}"',
                    },
                },
                {
                    name: 'showListActions',
                    check: {
                        args: /^спис(ок|ки) действи[яей]?$/i,
                    },
                    commandList: {
                        name: 'действия со списком',
                        usage: 'списки действия',
                        description: 'показывает возможные действия со списками',
                    },
                    messageTemplate: {
                        title: 'доступные действия со списками:',
                        body: '#{0}. #{1}#{2}',
                        fail: 'нет ни одного доступного действия',
                    },
                    web: {},
                },
                {
                    name: 'actionWithList',
                    check: {
                        args: /^(авто)?список (([\w\dа-яё]+)[\w\dа-яё ]*?) действи.? (.+)$/i,
                    },
                    commandList: {
                        name: 'действие со списком',
                        usage: '{авто}список (название) действие (название действия)',
                        description: 'выполняет действие со списком или автосписком, например "список админы действие позвать" позовет список админов',
                    },
                    vip: {
                        usages: 8,
                    },
                    messageTemplate: {
                        title: 'результат действия "#{0}" для списка "#{1}":',
                        body: '#{1}',
                        bodyUsers: '#{0}: #{1}',
                        failList: 'не найден список "#{0}"!',
                        failUsers: 'список "#{0}" пуст!',
                        failCommand: 'не найдено действие "#{0}"',
                    },
                },
                {
                    name: 'showList',
                    check: {
                        args: /^(пока(?:зать|жи) )?(авто)?список (([\w\dа-яё]+)[\w\dа-яё ]*)$/i,
                    },
                    commandList: {
                        name: 'показать список',
                        usage: '{авто}список (название)',
                        description: 'показывает список или автосписок',
                    },
                    messageTemplate: {
                        title: 'список "#{0}":',
                        body: '#{0}. #{1}',
                        fail: 'не найден список "#{0}"',
                        failUsers: 'список "#{0}" пуст!',
                    },
                    web: {
                        hidden: (props, chat) => NotesList.find({ chatId: chat.id }).count().exec()
                            .then(count => count === 0),
                        filter: (props, chat) => {
                            return NotesList.find({ chatId: chat.id }).exec().then(docs => {
                                return {
                                    name: {
                                        type: 'select',
                                        data: docs.map((doc, num) => ({
                                            label: doc.name,
                                            value: doc.name,
                                            default: num === 0,
                                        })),
                                        options: {
                                            placeholder: 'название списка',
                                        }
                                    },
                                }
                            })
                        },
                        output: props => `показать список ${props.name || ''}`
                    }
                },
                {
                    name: 'showLists',
                    check: {
                        args: /^(?:пока(?:зать|жи) )?(авто)?списки$/i,
                    },
                    commandList: {
                        name: 'показать списки',
                        usage: '{авто}списки',
                        description: 'показывает списки или автосписки'
                    },
                    messageTemplate: {
                        title: 'списки:',
                        titleAuto: 'доступные автосписки (параметры в (обычных) скобках - обязательные, в {фигурных} скобках - нет):',
                        body: '#{0}. #{1} (#{2} участн.) #{3}',
                        bodyAuto: '#{0}. #{1} #{3}',
                        fail: 'в чате нет ни одного списка',
                    },
                    web: {
                        output: 'списки',
                    },
                },
                {
                    name: 'deleteList',
                    check: {
                        args: /^удалить список ([\w\dа-яё]+)$/i,
                    },
                    commandList: {
                        name: 'удалить список',
                        usage: 'удалить список (название)',
                        description: 'удаляет список'
                    },
                    messageTemplate: {
                        title: 'успешно удален список "#{0}"',
                        fail: 'на найден список "#{0}"',
                        failProps: 'не заданы параметры',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    web: {
                        type: 'action',
                        submitText: 'удалить список',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'addToList',
                                'deleteFromList',
                                'showList',
                                'showLists',
                                'deleteList'
                            ],
                        },
                        hidden: (props, chat) => NotesList.find({ chatId: chat.id }).count().exec()
                            .then(count => count === 0),
                        filter: (props, chat) => {
                            return NotesList.find({ chatId: chat.id }).exec().then(docs => {
                                return {
                                    name: {
                                        type: 'multi',
                                        data: docs.map((doc, num) => ({
                                            label: doc.name,
                                            value: doc.name,
                                            default: num === 0,
                                        })),
                                        options: {
                                            placeholder: 'название списка',
                                        },
                                        clear: true,
                                    },
                                }
                            })
                        },
                        output: (props, chat, message, self) => {
                            if (!props.name.length) return message.setTitle(self.messageTemplate.failProps);
                            return promiseFactory.allSync(props.name.map(name => () => {
                                message.text = `удалить список ${name}`;
                                return this[self.name](chat, message, self);
                            })).then(() => message.getResult());
                        }
                    },
                },
            ],
        };
    }

    _init(bot) {
        return super._init(bot).then(() => {
            this.Message = class extends bot.Message {
                constructor(...args) {
                    super(...args);
                    this.result = [];
                    this.setSendedPromise();
                }

                setSendedPromise() {
                    this.sended = new Promise(resolve => {
                        this.sendedResolve = resolve;
                    });
                }

                /**
                 * @return {Promise<String>}
                 */
                getResult(force = false) {
                    setTimeout(this.sendedResolve, 1e4);
                    return this.sended.then(() => this.result.join('\n'));
                }

                send() {
                    this.sendedResolve();
                    let text = this.getText();
                    this.result.push(text);
                    this.new;
                    return Promise.resolve(0);
                }

                sendPhoto(source) {
                    return Promise.resolve();
                }
            };
            return promiseFactory.allAsync([
                this.bot.middlewareOn('Lists.getAutoLists', this._getAutoListsEvent, this),
            ]);
        })
    }

    _final() {
        return super._final().then(() => promiseFactory.allAsync([
            this.bot.removeMiddlewareOnByHandler('Lists.getAutoLists', this),
        ]))
    }

    /**
     *
     * @param {Number} chatId
     * @param {String} name
     * @param {Boolean} strict
     * @param {Object} db
     * @return {Promise}
     * @private
     */
    _findByDB(chatId, name, strict, db) {
        let regExpName;
        if (!strict) {
            regExpName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regExpName = new RegExp(`.*${regExpName}.*`, 'i');
        }
        return db.find({
            chatId,
            name: regExpName || name,
        }).exec().then(docs => {
            if (!docs.length) return undefined;
            for (let doc of docs) {
                if (doc.name === name) return doc;
            }
            return docs[0];
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {String} name
     * @param {Boolean} strict
     * @return {Promise}
     * @private
     */
    _findList(chat, name, strict = false) {
        return this._findByDB(chat.id, name, strict, NotesList)
            .then(list => {
                if (list) list.userId = list.userId.filter(id => chat.users.includes(id));
                return list;
            });
    }

    /**
     *
     * @param {Chat} chat
     * @return {Promise<Array>}
     * @private
     */
    _getAutoLists(chat) {
        if (!chat) return Promise.resolve(null);
        return this.bot.ctrlEmit((chat, lists) => {
            return lists;
        }, 'Lists.getAutoLists', chat, [])
            .then(lists => lists && lists.filter(l => l) || []);
    }

    /**
     *
     * @param {Chat} chat
     * @param {String} name
     * @return {Promise}
     * @private
     */
    _findAutoList(chat, name) {
        if (!chat) return Promise.resolve(null);
        return this._getAutoLists(chat).then(lists => {
            for (let list of lists) {
                if (list.check && list.check.exec(name)) {
                    return Promise.resolve(list.getUsers && list.getUsers(chat, name, list) || [])
                        .then(users => list.userId = users || [])
                        .then(() => list);
                }
            }
            return null;
        })
    }

    _getAutoListsEvent([chat, lists]) {
        if (!chat.modules.includes(this)) return;
        /**
         * @type {SpecificationCommand_Lists_autoList}
         */
        let autoList = {
            name: 'все',
            description: 'все участники чата',
            check: /^все$/,
            getUsers: () => chat.users.slice(),
            getUsersCount: () => chat.users.length,
        };
        lists.unshift(autoList);
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    addToList(chat, message, command) {
        let [,name, userNames] = command.check.args.exec(message.getCommandText());
        let users = [];
        name = name.slice(0, 10).replace('.', '');
        userNames = userNames || '';
        userNames.split(/\s*[\-,]\s*/).map(userName => {
            let userId = chat.findUser(userName);
            if (userName && userId) users.push(userId);
        });
        return promiseFactory.allAsync([
            NotesList.find({ chatId: chat.id }).count().exec(),
            this._findList(chat, name, true),
            message.loadFwd(),
        ]).then(([count, list, fwd]) => {
            if (!list && count >= this.options.maxChatLists) {
                return message.setTitleTemplate(command.messageTemplate.fail, this.options.maxChatLists).send();
            }
            fwd.forEach(item => {
                if (chat.users.includes(item.user_id) && !users.includes(item.user_id)) users.push(item.user_id);
            });
            let listUsers = list && list.userId || [];
            users = users.filter(userId => !listUsers.includes(userId));
            if (!users.length) return message.setTitle(command.messageTemplate.failUser).send();
            return NotesList.findOneAndUpdate(
                { chatId: chat.id, name: name },
                { $push: { userId: { $each: users } } },
                { upsert: true }
            ).then(() => {
                chat.emit('News.add', users, `пользователь [id${message.user}|${chat.userNames[message.user].fullName}] добавил вас в список "${name}"`);
                return message.setTitleTemplate(
                    command.messageTemplate.title,
                    users.map(userId => chat.userNames[userId].fullName).join(', '),
                    name
                ).send({
                    news: {
                        channel: this.newsChannel,
                        fromUser: message.user,
                    }
                });
            });
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    deleteFromList(chat, message, command) {
        let [,name, userNames] = command.check.args.exec(message.getCommandText());
        let users = [];
        userNames = userNames || '';
        userNames.split(/\s*[\-,]\s*/).map(userName => {
            let userId = chat.findUser(userName);
            if (userName && userId) users.push(userId);
        });
        return promiseFactory.allAsync([
            this._findList(chat, name),
            message.loadFwd(),
        ]).then(([list, fwd]) => {
            if (!list) return message.setTitleTemplate(command.messageTemplate.failList, name);
            fwd.forEach(item => {
                if (!users.includes(item.user_id)) users.push(item.user_id);
            });
            let deleteUsers = users.filter(userId => list.userId.includes(userId));
            if (!users.length) return message.setTitle(command.messageTemplate.failUser).send();
            return NotesList.findOneAndUpdate(
                { chatId: chat.id, name: list.name },
                { $pull: { userId: { $in: deleteUsers } } },
                { upsert: true }
            ).then(() => {
                chat.emit('News.add', users, `пользователь [id${message.user}|${chat.userNames[message.user].fullName}] удалил вас из списка "${name}"`);
                return message.setTitleTemplate(
                    command.messageTemplate.title,
                    deleteUsers.map(userId => chat.userNames[userId].fullName).join(', '),
                    list.name
                ).send({
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
    pingList(chat, message, command) {
        let [, users, text] = command.check.args.exec(message.getCommandText());
        users = users.split('-').map(user => chat.findUser(user.trim())).filter(user => user);
        if (!users.length) return message.setTitleTemplate(command.messageTemplate.failUsers).send();
        text = text.replace('.', '');
        return message.setTitleTemplate(
            command.messageTemplate.title,
            users.map(userId => `[id${userId}|${chat.userNames[userId].fullName}]`).join(', '),
            text
        ).send();
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    commandWithList(chat, message, command) {
        let [, isAuto, fullName, name, commandName] = command.check.args.exec(message.getCommandText());
        if (!isAuto && name !== fullName || /(^| )(команд.?|действи.?)($| )/i.test(fullName)) return;
        if (isAuto) name = fullName;
        let getList = isAuto ? this._findAutoList(chat, name) : this._findList(chat, name);
        return getList.then(list => {
            if (!list) return message.setTitleTemplate(command.messageTemplate.failList, name).send();
            let users = list.userId;
            // if (!users.length) return message
            //     .setTitleTemplate(command.messageTemplate.failUsers, isAuto ? name : list.name)
            //     .send();
            let listChat = Object.assign(new this.bot.Chat, chat);
            listChat.users = users.slice();
            let text = commandName;
            if (!this.bot.isBotName(text.split(' ')[0])) {
                text = this.bot.getBotName().concat(' ', text);
            }
            message.text = message.initialText = text;
            let setMessageTitle = true;
            return message.pre(message.eventNames.sendInit, () => {
                if (!setMessageTitle) return;
                let text = message.getText();
                let fwd = message.forward_messages;
                message.new.setTitleTemplate(
                    command.messageTemplate.title,
                    commandName,
                    isAuto ? name : list.name,
                    text
                );
                message.forward_messages = fwd;
            }).then(
                () => promiseFactory.allAsync(chat.modules.map(module => {
                    return module.runCommandByMessage(listChat, message);
                }))
            )
                .then(results => {
                    if (!results.filter(r => r !== null).length) {
                        setMessageTitle = false;
                        return message.new
                            .setTitleTemplate(command.messageTemplate.failCommand, commandName)
                            .send()
                            .then(() => null);
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
    showListActions(chat, message, command) {
        let actionsInfo = [];
        for (let module of chat.modules) {
            for (let command of module.specification.commands) {
                if (
                    command.lists && command.lists.listAction
                    && command.lists.listAction.name
                ) {
                    actionsInfo.push({ module, command });
                }
            }
        }
        if (!actionsInfo.length) return message.setTitleTemplate(command.messageTemplate.fail).send();
        return message.setTitleTemplate(command.messageTemplate.title)
            .setBodyTemplate(
                command.messageTemplate.body,
                n => n + 1,
                n => actionsInfo[n].command.lists.listAction.name,
                n => actionsInfo[n].command.lists.listAction.description
                    ? '\n&#8194; '+actionsInfo[n].command.lists.listAction.description
                    : ''
            )
            .setTemplateLength(actionsInfo.length)
            .send();
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    actionWithList(chat, message, command) {
        let [, isAuto, fullName, name, actionName] = command.check.args.exec(message.getCommandText());
        if (!isAuto && name !== fullName || /(^| )(команд.?|действи.?)($| )/i.test(fullName)) return;
        if (isAuto) name = fullName;
        let getList = isAuto ? this._findAutoList(chat, name) : this._findList(chat, name);
        return getList.then(list => {
            if (!list) return message.setTitleTemplate(command.messageTemplate.failList, name).send();
            // if (!list.userId.length) return message
            //     .setTitleTemplate(command.messageTemplate.failUsers, isAuto ? name : list.name)
            //     .send();
            for (let module of chat.modules) {
                for (let actionCommand of module.specification.commands) {
                    if (
                        actionCommand.lists && actionCommand.lists.listAction
                        && actionCommand.lists.listAction.check
                        && actionCommand.lists.listAction.check.exec(actionName)
                        && typeof actionCommand.lists.listAction.mapUsers === 'function'
                        && this.validateCommand(chat, message, actionCommand.check, false)
                    ) {
                        let commands;
                        return Promise.resolve(actionCommand.lists.listAction.mapUsers(
                            list.userId, actionName, actionCommand.lists.listAction
                        ))
                            .then(actionCommands => commands = [].concat(actionCommands))
                            .then(() => promiseFactory.allAsync(commands.map(commandText => () => {
                                let listMessage = this.Message.createFromEventMessage(this.bot, message.eventMessage);
                                listMessage.text = commandText;
                                if (!this.validateCommand(chat, listMessage, actionCommand.check)) return;
                                return module.runCommand(chat, listMessage, actionCommand)
                                    .then(() => listMessage.getResult());
                            })))
                            .then(results => {
                                let isUsersTemplate = results.length === list.userId.length;
                                let isSame = results.reduce((prev, current) => {
                                    if (prev === current) return current;
                                    return null;
                                });
                                if (isSame) results = [isSame];
                                if (!actionCommand.lists.listAction.withoutHeader) {
                                    message.setTitleTemplate(
                                        command.messageTemplate.title,
                                        actionName,
                                        isAuto ? name : list.name
                                    )
                                }
                                return message
                                    .setBodyTemplate(
                                        command.messageTemplate[isUsersTemplate ? 'bodyUsers' : 'body'],
                                        n => chat.userNames[list.userId[n]].fullName,
                                        n => results[n]
                                    )
                                    .setTemplateLength(results.length)
                                    .send();
                            })
                    }
                }
            }
            return message.setTitleTemplate(command.messageTemplate.failCommand, actionName).send();
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showList(chat, message, command) {
        let [, isFull, isAuto, fullName, name] =  command.check.args.exec(message.getCommandText());
        if (!isAuto && !isFull && name !== fullName || /(^| )(команд.?|действи.?)($| )/i.test(fullName)) return;
        if (isAuto) name = fullName;
        let getList = isAuto ? this._findAutoList(chat, name) : this._findList(chat, name);
        return getList.then(list => {
            if (!list) {
                return message.setTitleTemplate(command.messageTemplate.fail, name).send();
            }
            let users = list.userId.slice();
            if (!users.length) return message
                .setTitleTemplate(command.messageTemplate.failUsers, isAuto ? name : list.name)
                .send();
            return message
                .setTitleTemplate(command.messageTemplate.title, isAuto ? name : list.name)
                .setBodyTemplate(
                    command.messageTemplate.body,
                    n => n + 1,
                    n => chat.userNames[users[n]].fullName
                )
                .setTemplateLength(users.length)
                .send();
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showLists(chat, message, command) {
        let [, isAuto] =  command.check.args.exec(message.getCommandText());
        let getLists = isAuto ? this._getAutoLists(chat) : NotesList.find({ chatId: chat.id }).exec();
        return getLists
            .then(lists => {
                // if (!isAuto)
                return lists;
                // return promiseFactory.allAsync(lists.map(list => {
                //     return Promise
                //         .resolve(list.getUsersCount && list.getUsersCount(chat, list))
                //         .then(count => list.count = count);
                // })).then(() => lists);
            })
            .then(lists => {
                if (!lists.length) return message.setTitle(command.messageTemplate.fail).send();
                return message
                    .setTitle(command.messageTemplate[isAuto ? 'titleAuto' : 'title'])
                    .setBodyTemplate(
                        command.messageTemplate[isAuto ? 'bodyAuto' : 'body'],
                        n => n + 1,
                        n => lists[n].name,
                        n => isAuto ? '' : lists[n].userId.filter(userId => chat.users.includes(userId)).length,
                        n => isAuto && lists[n].description && '\n'+lists[n].description || ''
                    )
                    .setTemplateLength(lists.length)
                    .send();
            })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    deleteList(chat, message, command) {
        let [, name] =  command.check.args.exec(message.getCommandText());
        return this._findList(chat, name).then(list => {
            if (!list) return message.setTitleTemplate(command.messageTemplate.fail, name).send();
            return list.remove().then(() => {
                return message.setTitleTemplate(command.messageTemplate.title, list.name).send();
            });
        });
    }
};
