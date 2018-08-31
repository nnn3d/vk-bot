'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const NotesChat = require('./NotesChat');
const NotesRemind = require('./NotesRemind');

module.exports = class Notes extends ModuleEventController {

    constructor(options) {
        super();
        this.options = {
            maxChatNotes: 10,
            maxChatRemind: 10,
        };
        this.options = Object.assign(this.options, options);
        this.remindTimers = {};
    }


    /**
     *
     * @return {Specification}
     */
    moduleSpecification() {
        return {
            type: 'chat',
            commandList: {
                name: 'Заметки',
                description: 'Позволяет оставлять заметки и делать напоминания',
            },
            web: {
                icon: {
                    name: 'FaStickyNote',
                    options: {
                        color: '#c7d647',
                    }
                },
            },
            commands: [
                {
                    name: 'addNote',
                    check: {
                        args: /^заметка ([\w\dа-яё]+) ((?:.|\n)+)$/i,
                    },
                    commandList: {
                        name: 'новая заметка',
                        usage: 'заметка (название - одно слово) {текст}',
                        description: 'добавляет новую заметку, можно переслать сообщения с текстом',
                    },
                    vip: {
                        usages: 10,
                    },
                    messageTemplate: {
                        titleNew: 'успешно добавлена новая заметка "#{0}"',
                        titleEdit: 'успешно обновлена заметка "#{0}"',
                        fail: 'невозможно добавить заметку - не может быть больше #{0} заметок в чате!',
                        failText: 'не указан текст заметки!',
                        failProps: 'не заданы параметры',
                        webLoad: 'заметка #{0} загружена',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    web: {
                        type: 'action',
                        submitText: props => props && props.name ? `сохранить заметку ${props.name}` : 'выбрать заметку',
                        change: props => {
                            let change = {
                                module: this.constructor.name,
                                command: [
                                    'addNote',
                                ],
                            };
                            if (props && props.text) {
                                change.command.push(
                                    'showNote',
                                    'showNotes',
                                    'deleteNote'
                                );
                            }
                            return change;
                        },
                        filter: (props, chat, message, self) => {
                            return NotesChat.find({ chatId: chat.id }).exec().then(docs => {
                                let filter = {
                                    name: {
                                        type: 'combo',
                                        data: docs.map(doc => ({
                                            label: doc.name,
                                            value: doc.name,
                                        })),
                                        options: {
                                            placeholder: 'название заметки',
                                            disabled: props && props.name && !props.text,
                                            suggest: true,
                                        },
                                        clear: props && props.text,
                                    },
                                };
                                if (props && props.name && !props.text) {
                                    let note = docs.filter(doc => doc.name === props.name)[0];
                                    filter.text = {
                                        type: 'textarea',
                                        data: {
                                            value: note && note.text || '',
                                            select: true,
                                        },
                                        options: {
                                            placeholder: 'текст заметки',
                                            rows: 5,
                                        },
                                    };
                                    return filter;
                                } else return filter;
                            })
                        },
                        output: (props, chat, message, self) => {
                            if (!props) return message.setTitle(self.messageTemplate.failProps).send();
                            if (props.name) {
                                if (props.text) return `заметка ${props.name.split(' ')[0]} ${props.text}`;
                                else return message.setTitleTemplate(self.messageTemplate.webLoad, props.name).send();
                            }
                        },
                    },
                },
                {
                    name: 'showNote',
                    check: {
                        args: /^заметка ([\w\dа-яё]+)$/i,
                    },
                    commandList: {
                        name: 'показать заметку',
                        usage: 'заметка (название)',
                        description: 'показывает заметку',
                    },
                    messageTemplate: {
                        title: 'заметка "#{0}":\n#{1}',
                        fail: 'не найдена заметка "#{0}"',
                    },
                    disableReload: true,
                    web: {
                        hidden: (props, chat) => NotesChat.find({ chatId: chat.id }).count().exec()
                            .then(count => count === 0),
                        filter: (props, chat) => {
                            return NotesChat.find({ chatId: chat.id }).exec().then(docs => {
                                let select = props && props.name
                                    && !docs.filter(doc => doc.name === props.name).length || !props;
                                return {
                                    name: {
                                        type: 'select',
                                        options: {
                                            placeholder: 'заметки',
                                        },
                                        data: docs.map((doc, num) => ({
                                            label: doc.name,
                                            value: doc.name,
                                            default: num === 0,
                                            select: select && num === 0,
                                        })),
                                    }
                                }
                            })
                        },
                        output: (props, chat, message, self) => `заметка ${props.name.split(' ')[0]}`,
                    },
                },
                {
                    name: 'showNotes',
                    check: {
                        args: /^заметки$/i,
                    },
                    commandList: {
                        name: 'показать заметки',
                        usage: 'заметки',
                        description: 'показывает заметки'
                    },
                    messageTemplate: {
                        title: 'заметки:',
                        body: '#{0}. #{1}',
                        fail: 'нет ни одной заметки',
                    },
                    web: {},
                },
                {
                    name: 'deleteNote',
                    check: {
                        args: /^удалить заметку ([\w\dа-яё]+)$/i,
                    },
                    commandList: {
                        name: 'удалить заметку',
                        usage: 'удалить заметку (название)',
                        description: 'удаляет заметку'
                    },
                    messageTemplate: {
                        title: 'успешно удалена заметка "#{0}"',
                        fail: 'не найдена заметка "#{0}"',
                        failProps: 'не заданы параметры',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    web: {
                        type: 'action',
                        submitText: 'удалить заметку',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'addNote',
                                'showNote',
                                'showNotes',
                                'deleteNote',
                            ],
                        },
                        hidden: (props, chat) => NotesChat.find({chatId: chat.id}).count().exec()
                            .then(count => count === 0),
                        filter: (props, chat) => {
                            return NotesChat.find({chatId: chat.id}).exec().then(docs => {
                                return {
                                    name: {
                                        type: 'multi',
                                        options: {
                                            placeholder: 'заметки',
                                        },
                                        data: docs.map((doc, num) => ({
                                            label: doc.name,
                                            value: doc.name,
                                        })),
                                        clear: true,
                                    }
                                }
                            })
                        },
                        output: (props, chat, message, self) => {
                            if (!props.name.length) return message.setTitle(self.messageTemplate.failProps);
                            return promiseFactory.allSync(props.name.map(name => () => {
                                message.text = `удалить заметку ${name.split(' ')[0]}`;
                                return this[self.name](chat, message, self);
                            })).then(() => message.getResult());
                        },
                    },
                },
                {
                    name: 'addRemind',
                    check: {
                        args: /^напом(?:инание|ни)(?: (.+))? через(?: (\d{1,3}) д[ен][еня][а-я]*)?(?: (\d{1,3}) час[а-я]*)?(?: (\d{1,3}) мин[а-я]*)?$/i,
                    },
                    commandList: {
                        name: 'новое напоминание',
                        usage: 'напомни {текст} через {число "дней"} {число "часов"} {число "минут"}',
                        description: 'создает напоминание, например - "напомни сварить кофе через 2 часа 5 минут", можно переслать сообщения с текстом',
                    },
                    vip: {
                        usages: 10,
                    },
                    messageTemplate: {
                        title: 'добавлено новое напоминание "#{0}" через #{1}',
                        failCount: 'невозможно добавить напоминание - не может быть больше #{0} напоминаний в чате!',
                        failEmpty: 'не указано время, через которое напомнить!',
                        failText: 'не указан текст напоминания!',
                    },
                },
                {
                    name: 'showRemind',
                    check: {
                        args: /^напоминания$/i,
                    },
                    commandList: {
                        name: 'напоминания',
                        description: 'показывает напоминания в чате'
                    },
                    messageTemplate: {
                        title: 'напоминания:',
                        body: '#{0}. "#{1}" через #{2}',
                        fail: 'у вас нет ни одного напоминания',
                    },
                    web: {},
                },
                {
                    name: 'deleteRemind',
                    check: {
                        args: /^удалить напоминани[ея]$/i,
                    },
                    commandList: {
                        name: 'удалить напоминание',
                    },
                    messageTemplate: {
                        titleChoose: 'введи номер напоминания для продолжения:',
                        body: '#{0}. "#{1}" через #{2}',
                        title: 'успешно удалено напоминание "#{0}"',
                        fail: 'у вас нет ни одного напоминания',
                        failProps: 'не заданы параметры',
                        failRemove: 'ошибка удаления напоминания "#{0}"',
                    },
                    web: {
                        type: 'action',
                        submitText: 'удалить напоминание',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'addRemind',
                                'showRemind',
                                'deleteRemind',
                            ],
                        },
                        hidden: (props, chat, message) => NotesRemind.find({ chatId: chat.id, userId: message.user })
                            .count().exec().then(count => count === 0),
                        filter: (props, chat, message, self) => {
                            return NotesRemind.find({ chatId: chat.id, userId: message.user }).exec().then(docs => {
                                return {
                                    name: {
                                        type: 'multi',
                                        data: docs.map(doc => ({
                                            label: doc.name,
                                            value: doc.name,
                                        })),
                                        options: {
                                            placeholder: 'напоминание',
                                        },
                                        clear: true,
                                    }
                                }
                            })
                        },
                        output: (props, chat, message, self) => {
                            if (!props.name.length) return message.setTitle(self.messageTemplate.failProps);
                            return promiseFactory.allSync(props.name.map(name => {
                                return NotesRemind.remove({ chatId: chat.id, userId: message.user, name })
                                    .then(() => message.setTitleTemplate(self.messageTemplate.title, name).send())
                                    .catch(() => message.setTitleTemplate(self.messageTemplate.failRemove, name).send())
                            })).then(() => message.getResult());
                        },
                    }
                },
            ],
        };
    }

    _initChat(chat) {
        return super._initChat(chat).then(() => {
            return this._loadChatReminds(chat);
        })
    }

    _finalChat(chat) {
        return super._finalChat(chat).then(() => {
            return this._clearChatReminds(chat);
        });
    }

    /**
     *
     * @param {Number} time
     * @return {string}
     * @private
     */
    _periodToText(time) {
        let desc = [];
        if (time >= 24 * 60 * 60 * 1000) {
            desc.push(Math.floor(time / (24 * 60 * 60 * 1000)) + ' дн.');
            time = time % (24 * 60 * 60 * 1000);
        }
        if (time >= 60 * 60 * 1000) {
            desc.push(Math.floor(time / (60 * 60 * 1000)) + ' ч.');
            time = time % (60 * 60 * 1000);
        }
        if (time >= 60 * 1000 || !desc.length) {
            desc.push(Math.floor(time / (60 * 1000)) + ' мин.');
        }
        return desc.join(' ');
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
     * @param {Number} chatId
     * @param {String} name
     * @param {Boolean} strict
     * @return {Promise}
     * @private
     */
    _findNote(chatId, name, strict = false) {
        return this._findByDB(chatId, name, strict, NotesChat);
    }

    /**
     *
     * @param chat
     * @returns {Promise}
     * @private
     */
    _loadChatReminds(chat) {
        return NotesRemind.find({ chatId: chat.id }).exec().then(docs => {
            docs.map(doc => this._setRemind(chat, doc.userId, doc.name, doc.time));
        });
    }

    /**
     *
     * @param chat
     * @returns {Promise}
     * @private
     */
    _clearChatReminds(chat) {
        if (this.remindTimers[chat.id]) {
            this.remindTimers[chat.id].map(timer => clearTimeout(timer));
            delete this.remindTimers[chat.id];
            return Promise.resolve(true);
        }
        return Promise.resolve(null);
    }

    /**
     *
     * @param chat
     * @returns {Promise}
     * @private
     */
    _updateChatReminds(chat) {
        return this._clearChatReminds(chat).then(() => this._loadChatReminds(chat));
    }

    /**
     *
     * @param {Chat} chat
     * @param {String} userId
     * @param {String} name
     * @param {Number} time
     * @return {Promise}
     * @private
     */
    _setRemind(chat, userId, name, time) {
        if (!this.remindTimers[chat.id]) this.remindTimers[chat.id] = [];
        if (time > Date.now()) {
            if (time - Date.now() > 2147483647) {
                this.remindTimers[chat.id].push(setTimeout(() => this._setRemind(chat, userId, name, time), 2147483647));
            } else {
                this.remindTimers[chat.id].push(setTimeout(() => this._sendRemind(chat, userId, name), time - Date.now()));
            }
            return Promise.resolve(null);
        } else {
            return this._sendRemind(chat, userId, name);
        }
    }

    /**
     *
     * @param {Chat} chat
     * @param {String} userId
     * @param {String} name
     * @return {Promise}
     * @private
     */
    _sendRemind(chat, userId, name) {
        let result = Promise.resolve();
        if (chat.users.includes(userId)) {
            let message = new this.bot.Message({peer: chat.id});
            result = message.setTitle(`[id${userId}|${chat.userNames[userId].fullName}], напоминаю ${name}`).send();
        }
        return result.then(() => {
            return NotesRemind.remove({
                chatId: chat.id,
                userId,
                name
            });
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    addNote(chat, message, command) {
        let info = command.check.args.exec(message.getCommandText());
        let name = info[1];
        let text = info[2] || '';
        name = name.slice(0, 10).replace('.', '');
        return promiseFactory.allAsync([
            this._findNote(chat.id, name, true),
            NotesChat.find({ chatId: chat.id }).count().exec(),
            message.loadFwd(),
        ]).then(([note, count, fwd]) => {
            if (!note && count >= this.options.maxChatNotes) {
                return message.setTitleTemplate(command.messageTemplate.fail, this.options.maxChatNotes).send();
            }
            let fwdText = fwd.map(m => m.body).filter(m => m).join('\n');
            if (fwdText) {
                if (text) text += '\n';
                text += fwdText;
            }
            text = text.replace('.', '');
            if (!text) return;
            let template = note ? command.messageTemplate.titleEdit : command.messageTemplate.titleNew;
            return NotesChat.findOneAndUpdate(
                { chatId: chat.id, name },
                { text },
                { upsert: true }
            ).then(() => message.createReply().setTitleTemplate(template, name).send());
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showNote(chat, message, command) {
        let info = command.check.args.exec(message.getCommandText());
        let name = info[1];
        if (message.hasFwd()) return;
        return this._findNote(chat.id, name).then(note => {
            if (!note) return message.setTitleTemplate(command.messageTemplate.fail, name).send();
            return message.setTitleTemplate(command.messageTemplate.title, note.name, note.text).send();
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showNotes(chat, message, command) {
        return NotesChat.find({ chatId: chat.id }).then(notes => {
            if (!notes.length) return message.setTitleTemplate(command.messageTemplate.fail).send();
            return message
                .setTitle(command.messageTemplate.title)
                .setBodyTemplate(
                    command.messageTemplate.body,
                    n => n + 1,
                    n => notes[n].name
                )
                .setTemplateLength(notes.length)
                .send();
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    deleteNote(chat, message, command) {
        let info = command.check.args.exec(message.getCommandText());
        let name = info[1];
        return this._findNote(chat.id, name).then(note => {
            if (!note) return message.setTitleTemplate(command.messageTemplate.fail, name).send();
            return note.remove().then(() => {
                return message.setTitleTemplate(command.messageTemplate.title, note.name).send();
            });
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    addRemind(chat, message, command) {
        let [, name, days, hours, minutes] = command.check.args.exec(message.getCommandText());
        [days, hours, minutes] = [days, hours, minutes].map(info => info ? +info : 0);
        if (days + hours + minutes === 0) return message.setTitle(command.messageTemplate.failEmpty).send();
        name = name || '';
        return promiseFactory.allAsync([
            NotesRemind.find({ chatId: chat.id, userId: message.user }).count().exec(),
            message.loadFwd(),
        ])
            .then(([count, fwd]) => {
                if (count >= this.options.maxChatRemind) {
                    return message.setTitleTemplate(command.messageTemplate.failCount, this.options.maxChatRemind).send();
                }
                let fwdText = fwd.map(m => m.body).filter(m => m).join('\n');
                if (fwdText) {
                    if (name) name += '\n';
                    name += fwdText;
                }
                if (!name) return;
                name = name.replace('.', '');
                let period = ((days * 24 + hours) * 60 + minutes) * 6e4;
                let time = Date.now() + period;
                return NotesRemind.findOneAndUpdate(
                    {
                        chatId: chat.id,
                        userId: message.user,
                        name,
                    },
                    { time },
                    { upsert: true }
                )
                    .then(
                        () => message.setTitleTemplate(
                            command.messageTemplate.title,
                            name,
                            this._periodToText(period)
                        ).createReply().send()
                    )
                    .then(() => this._updateChatReminds(chat));
            })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showRemind(chat, message, command) {
        return NotesRemind.find({ chatId: chat.id, userId: message.user }).exec().then(docs => {
            if (!docs.length) return message.setTitle(command.messageTemplate.fail).send();
            docs.sort((a, b) => a.time - b.time);
            return message
                .setTitle(command.messageTemplate.title)
                .setBodyTemplate(
                    command.messageTemplate.body,
                    n => n + 1,
                    n => docs[n].name,
                    n => this._periodToText(docs[n].time - Date.now())
                )
                .setTemplateLength(docs.length)
                .send();
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    deleteRemind(chat, message, command) {
        return NotesRemind.find({ chatId: chat.id, userId: message.user }).exec().then(docs => {
            if (!docs.length) return message.setTitle(command.messageTemplate.fail).send();
            docs.sort((a, b) => a.time - b.time);
            let regex = /^\D{0,10}(\d+)/i;
            let onMessage;
            let timeout;
            let stop = () => {
                clearTimeout(timeout);
                return chat.removeListenerOn(chat.eventNames.message, onMessage);
            };
            /**
             *
             * @param {Message} messageChoose
             */
            onMessage = messageChoose => {
                if (messageChoose.user !== message.user || !regex.test(messageChoose.getCommandText())) return;
                let info = regex.exec(messageChoose.getCommandText());
                let remind = docs[info[1] - 1];
                if (!remind) return;
                return stop()
                    .then(() => remind.remove())
                    .then(() => messageChoose.setTitleTemplate(command.messageTemplate.title, remind.name).send())
                    .then(() => this._updateChatReminds(chat))
            };
            timeout = setTimeout(stop, 6e4);
            return message
                .setTitle(command.messageTemplate.titleChoose)
                .setBodyTemplate(
                    command.messageTemplate.body,
                    n => n + 1,
                    n => docs[n].name,
                    n => this._periodToText(docs[n].time - Date.now())
                )
                .setTemplateLength(docs.length)
                .createReply()
                .send()
                .then(() => chat.on(chat.eventNames.message, onMessage));
        });
    }
};