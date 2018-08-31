'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const NewsHistory = require('./NewsHistory');

module.exports = class News extends ModuleEventController {

    constructor() {
        super();
        this.dateFormatter = new Intl.DateTimeFormat('ru', {
            hour: 'numeric',
            minute: 'numeric',
        });
        this.config = {
            maxUserNews: 20,
            maxUserNewLength: 150,
            maxNewsInMessage: 60,
        }
    }

    /**
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            type: 'chat',
            commandList: {
                name: 'Новости',
                description: 'Показывает, что происходило в чате за последний день',
            },
            web: {
                icon: {
                    name: 'FaNewspaperO',
                    options: {
                        color: '#00cabf',
                    }
                },
            },
            commands: [
                {
                    name: 'mineNews',
                    check: {
                        args: 'мои новости',
                    },
                    commandList: {
                        name: 'мои новости',
                        description: 'показывает новости, касающиеся вас',
                    },
                    messageTemplate: {
                        title: '#{0}, ваши новости за последний день:',
                        body: '#{0}#{1}: #{2}',
                        failEmpty: '#{0}, пока новостей для вас нет'
                    },
                    web: {},
                },
                {
                    name: 'channelNews',
                    check: {
                        args: /^новости(?: ([а-яё ]+))?$/i,
                    },
                    commandList: {
                        name: 'новости',
                        usage: 'новости {каналы через пробел}',
                        description: 'показывает новости, из одного или нескольких каналов',
                    },
                    messageTemplate: {
                        title: 'новости за последний день (канал: #{0}):',
                        body: '#{0} (канал "#{1}"): #{2}',
                        failEmpty: 'пока новостей по данным каналам (#{0}) нет'
                    },
                    web: {},
                },
                {
                    name: 'addNew',
                    check: {
                        args: /^добавить новость(?: ((?:.|\n)+))?$/i,
                    },
                    commandList: {
                        name: 'добавить новость',
                        usage: 'добавить новость (текст новости или пересылаемое сообщение)',
                        description: 'добавляет новость для всех текущих участников чата',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    vip: {
                        usages: 5,
                    },
                    messageTemplate: {
                        title: 'новость "#{0}" успешно добавлена',
                        failCount: 'не может быть больше #{0} добавленных новостей, удалите одну или подождите, пока истечет срок действия последней новости (24 часа)',
                        failLength: 'длина новости не может быть больше #{0} символов',
                        failText: 'введите текст новости после команды или перешлите сообщение с текстом вместе с командой'
                    },
                },
                {
                    name: 'deleteNew',
                    check: {
                        args: /^удалить новость$/i,
                    },
                    commandList: {
                        name: 'удалить новость',
                        description: 'удаляет ранее добавленную новость',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'новость "#{0}" успешно удалена',
                        titleChoose: 'введите номер новости для удаления',
                        body: '#{0}. #{1}: #{2}',
                        fail: 'нет ни одной добавленной новости',
                    },
                },
                {
                    name: 'channels',
                    check: {
                        args: 'каналы новостей',
                    },
                    commandList: {
                        name: 'каналы новостей',
                        description: 'показывает доступные каналы новостей (появляются по мере добавления новостей)',
                    },
                    messageTemplate: {
                        title: 'доступные каналы новостей:',
                        body: '• #{0}',
                        failEmpty: 'пока нет доступных каналов (добавляются по мере добавления новостей)'
                    },
                },
            ],
        }
    }

    _initChat(chat) {
        return super._initChat(chat).then(() => promiseFactory.allAsync([
            chat.on('News.add', (...args) => this._addNew(chat, ...args), this),
            chat.after(chat.eventNames['chat.invite'], (event) => this._onInvite(chat, event), this),
            chat.on(chat.eventNames['chat.kick'], (event) => this._onKick(chat, event), this),
            this.bot.Message.global.on(this.bot.Message.eventNames.send, this._onSendMessage, this),
        ]));
    }

    _finalChat(chat) {
        return super._finalChat(chat).then(() => promiseFactory.allAsync([
            chat.removeListenersOnByHandler('News.add', this),
            chat.removeListenersAfterByHandler(chat.eventNames['chat.invite'], this),
            chat.removeListenersOnByHandler(chat.eventNames['chat.kick'], this),
            this.bot.Message.global.removeListenersOnByHandler(this.bot.Message.eventNames.send, this),
        ]));
    }

    _addNew(chat, channelOrUserId, text, setInfo = {}) {
        let set = {
            chatId: chat.id,
            date: new Date(),
            text,
        };
        if (typeof channelOrUserId === 'number' || channelOrUserId instanceof Array) {
            set.userId = [].concat(channelOrUserId);
        } else if (typeof channelOrUserId === 'string') {
            set.channel = channelOrUserId.toString();
        }
        set = Object.assign(set, setInfo);
        return new NewsHistory(set).save();
    }

    _onInvite(chat, event) {
        let text;
        if (event.link) {
            text = `[id${event.invite}|${chat.userNames[event.invite].fullName}] присоединился к беседе по ссылке`;
        } else if (event.user === event.invite) {
            text = `[id${event.invite}|${chat.userNames[event.invite].fullName}] вернулся в беседу`;
        } else {
            text = `[id${event.user}|${chat.userNames[event.user].fullName}] пригласил пользователя [id${event.invite}|${chat.userNames[event.invite].fullName}] в беседу`
        }
        return this._addNew(chat, 'состав', text);
    }

    _onKick(chat, event) {
        let text;
        if (event.user === event.kick) {
            text = `[id${event.kick}|${chat.userNames[event.kick].fullName}] покинул беседу`;
        } else {
            text = `[id${event.user}|${chat.userNames[event.user].fullName}] выгнал пользователя [id${event.kick}|${chat.userNames[event.kick].fullName}] из беседы`
        }
        return this._addNew(chat, 'состав', text);
    }

    _onSendMessage(params, message) {
        if (params.news) {
            let chat = this.bot.chats[message.peer];
            let channelOrUserId = params.news instanceof Object
                ? params.news.channel || params.news.userId
                : params.news;
            if (!channelOrUserId || !chat || !chat.modules.includes(this)) return;
            let preText = params.news.preText || '';
            let afterText = params.news.afterText || '';
            let userText = '';
            if (params.news.fromUser) {
                userText = `[id${params.news.fromUser}|${chat.userNames[params.news.fromUser].fullName}] - `;
            }
            let text = userText + preText + message.getText() + afterText;
            delete params.news;
            return this._addNew(chat, channelOrUserId, text);
        }
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    mineNews(chat, message, command) {
        return NewsHistory.find({
            userId: message.user,
            chatId: chat.id,
        }).sort({ date: -1 }).exec().then(docs => {
            if (!docs.length) {
                return message.setTitleTemplate(
                    command.messageTemplate.failEmpty,
                    chat.userNames[message.user].fullName,
                ).send();
            }
            docs = docs.slice(0, this.config.maxNewsInMessage);
            return message
                .setTitleTemplate(
                    command.messageTemplate.title,
                    chat.userNames[message.user].fullName,
                )
                .setBodyTemplate(
                    command.messageTemplate.body,
                    n => this.dateFormatter.format(docs[n].date),
                    n => docs[n].fromUser && ` ([id${docs[n].fromUser}|${chat.userNames[docs[n].fromUser].fullName}])` || '',
                    n => docs[n].text,
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
    channelNews(chat, message, command) {
        let info = command.check.args.exec(message.getCommandText());
        let channelsText = info && info[1];
        let queryObject = {
            chatId: chat.id,
            channel: { $exists: true },
        };
        if (channelsText) {
            let channels = channelsText
                .split(' ')
                .filter(c => c)
                .map(channel => new RegExp(channel, 'i'));
            queryObject.channel = { $in: channels };
        }

        let query = () => NewsHistory.find(queryObject);
        return promiseFactory.allAsync([
            query().sort({ date: -1 }).exec(),
            query().distinct('channel').exec()
        ]).then(([docs, channels]) => {
            if (!docs.length) {
                return message
                    .setTitleTemplate(
                        command.messageTemplate.failEmpty,
                        channels.length ? channels.join(', ') : channelsText || 'все'
                    )
                    .send()
            }
            docs = docs.slice(0, this.config.maxNewsInMessage);
            return message
                .setTitleTemplate(
                    command.messageTemplate.title,
                    channels.join(' '),
                )
                .setBodyTemplate(
                    command.messageTemplate.body,
                    n => this.dateFormatter.format(docs[n].date),
                    n => docs[n].channel,
                    n => docs[n].text,
                )
                .setTemplateLength(docs.length)
                .send();
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    addNew(chat, message, command) {
        let [, text] = command.check.args.exec(message.getCommandText());
        text = text || '';
        return promiseFactory.allAsync([
            NewsHistory.find({ chatId: chat.id, fromUser: {$exists: true} }).count(),
            message.hasFwd() && message.loadFwd(),
        ])
            .then(([newsCount, fwd]) => {
                if (fwd) {
                    text += fwd.map(fwd => fwd.body).join('\n');
                }
                if (newsCount > this.config.maxUserNews) {
                    return message
                        .setTitleTemplate(command.messageTemplate.failCount, this.config.maxUserNews)
                        .send();
                } else if (!text) {
                    return message.setTitleTemplate(command.messageTemplate.failText).send();
                } else if (text.length > this.config.maxUserNewLength) {
                    return message
                        .setTitleTemplate(command.messageTemplate.failLength, this.config.maxUserNewLength)
                        .send();
                }
                return new NewsHistory({
                    chatId: chat.id,
                    userId: chat.users,
                    fromUser: message.user,
                    date: new Date(),
                    text
                }).save().then(() => (
                    message.setTitleTemplate(command.messageTemplate.title, text).send()
                ));
            })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    deleteNew(chat, message, command) {
        return NewsHistory.find({ chatId: chat.id, fromUser: {$exists: true} }).sort({ date: -1 }).exec().then(docs => {
            if (!docs.length) return message.setTitle(command.messageTemplate.fail).send();
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
                    .then(() => messageChoose.setTitleTemplate(command.messageTemplate.title, remind.text).send())
            };
            timeout = setTimeout(stop, 6e4);
            return message
                .setTitle(command.messageTemplate.titleChoose)
                .setBodyTemplate(
                    command.messageTemplate.body,
                    n => n + 1,
                    n => this.dateFormatter.format(docs[n].date),
                    n => docs[n].text
                )
                .setTemplateLength(docs.length)
                .createReply()
                .send()
                .then(() => chat.on(chat.eventNames.message, onMessage));
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    channels(chat, message, command) {
        return NewsHistory.find({
            chatId: chat.id,
        }).distinct('channel').exec().then(docs => {
            if (!docs.length) {
                return message.setTitleTemplate(command.messageTemplate.failEmpty).send();
            }
            return message.setTitleTemplate(command.messageTemplate.title)
                .setBodyTemplate(
                    command.messageTemplate.body,
                    n => docs[n],
                )
                .setTemplateLength(docs.length)
                .send();
        })
    }
};
