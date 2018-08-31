'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const ChatBotName = require('./ChatBotName');

module.exports = class BotNameChange extends ModuleEventController {

    constructor() {
        super();
        this.chatNames = {};
        this.maxChatNames = 10;
        this.newsChannel = 'имена';
    }

    /**
     *
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            type: 'chat',
            commandList: {
                name: 'Имя бота',
                description: 'Позволяет менять имя бота',
            },
            vip: {
                paid: true,
            },
            web: {
                icon: {
                    name: 'MdChatBubble',
                    options: {
                        color: '#eadd5f',
                    }
                },
            },
            commands: [
                {
                    name: 'setName',
                    check: ['установить', 'имя', /^[а-яёa-z]+$/i],
                    messageTemplate: {
                        title: 'для бота добавлено имя "#{0}"',
                        fail: 'не может быть больше #{0} дополнительных имен бота!',
						failLength: 'имя не может быть меньше 3 символов.'
                    },
                    commandList: {
                        name: 'установить имя',
                        usage: 'установить имя (имя)',
                        description: 'устанавливает новое имя для бота',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    web: {
                        type: 'action',
                        submitText: 'добавить имя',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'getNames',
                                'deleteName'
                            ]
                        },
                        filter: {
                            name: {
                                type: 'text',
                                options: {
                                    placeholder: 'новое имя',
                                },
                                clear: true,
                            },
                        },
                        output: props => `установить имя ${props.name}`,
                    }
                },
                {
                    name: 'getNames',
                    check: ['им(я|ена)'],
                    messageTemplate: {
                        title: 'имена бота:',
                        body: '• #{0}',
                    },
                    commandList: {
                        name: this.newsChannel,
                        description: 'показывает имена бота',
                    },
                    web: {
                        output: this.newsChannel,
                    }
                },
                {
                    name: 'deleteName',
                    check: ['удалить', 'имя', /^[а-яёa-z]+$/i],
                    messageTemplate: {
                        title: 'у бота удалено имя "#{0}"',
                        titleFail: 'у бота нет имени "#{0}"',
                    },
                    commandList: {
                        name: 'удалить имя',
                        usage: 'удалить имя (имя)',
                        description: 'удаляет установленное имя бота',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    web: {
                        type: 'action',
                        submitText: 'удалить',
                        change: {
                            module: this.constructor.name,
                        },
                        hidden: (props, chat) => {
                            return ChatBotName.find({chatId: chat.id}).count().exec().then(count => {
                                return count === 0;
                            })
                        },
                        filter: (props, chat) => {
                            return ChatBotName.find({chatId: chat.id}).exec().then(docs => {
                                return {
                                    names: {
                                        type: 'multi',
                                        data: docs.map(doc => ({
                                            label: doc.botName,
                                            value: doc.botName,
                                        })),
                                        options: {
                                            placeholder: 'имя бота',
                                        },
                                        clear: true,
                                    },
                                }
                            })
                        },
                        output: (props, chat, message, self) => {
                            if (!props.names.length)
                                return Promise.resolve('Не заданы параметры');
                            let result = Promise.resolve();
                            props.names.map(name => {
                                result = result.then(() => {
                                    message.text = `удалить имя ${name}`;
                                    return this[self.name](chat, message, self);
                                });
                            });
                            return result.then(() => message.getResult());
                        }
                    }
                },
            ]
        };
    }

    _init(bot) {
        return super._init(bot).then(() => {
            process.on('message', packet => {
                if (packet.topic === 'BotNameChangeAdd' && !this.bot.clusterMode.isClusterChat(packet.data.chatId)
                    && !this.chatNames[packet.data.chatId].includes(packet.data.botName))
                    this.chatNames[packet.data.chatId].push(packet.data.botName);
            });
        });
    }

    _initChat(chat) {
        return super._initChat(chat).then(() => {
            this.chatNames[chat.id] = [];
            return this._updateNames(chat.id)
                .then(() => chat.middlewareOn(chat.eventNames.message, args => this._middlewareOn(args, chat), this));
        })
    }

    _final() {
        return super._final();
    }

    _finalChat(chat) {
        return chat.removeMiddlewareOnByHandler(chat.eventNames.message, this);
    }

    _middlewareOn([message], chat) {
        let name = message.getArgs()[0];
        for (let n of this.chatNames[chat.id]) {
            if (new RegExp(`^${n}$`, 'i').test(name)) {
                message.text = this.bot.getBotName() + ' ' + message.getArgs().slice(1).join(' ');
                message.text = message.text.trim();
                break;
            }
        }
    }

    _updateNames(chatId) {
        return ChatBotName.find({chatId: chatId}).exec().then(docs => {
            this.chatNames[chatId] = docs.map((doc) => doc.botName);
        });
    }

    setName(chat, message, command) {
        if (!message.getCommandArgs()[2]) return;
        let botName = message.getCommandArgs()[2]
            .toLowerCase()
            .replace(/[^a-zа-яё]/ig, '');
        if (!botName.length) return;
		if (botName.length<3) return message.setTitleTemplate(command.messageTemplate.failLength).send();
        return promiseFactory.allAsync([
            ChatBotName.findOne({chatId: chat.id, botName}).exec(),
            ChatBotName.find({chatId: chat.id}).count().exec(),
        ]).then(([doc, docsCount]) => {
            if (docsCount >= this.maxChatNames)
                return message.setTitleTemplate(command.messageTemplate.fail, this.maxChatNames).send();
            if (doc) return message.setTitleTemplate(command.messageTemplate.title, botName).send();
            return ChatBotName.findOneAndUpdate(
                {
                    chatId: chat.id,
                    botName,
                },
                { botName },
                { upsert: true }
            )
                .then(() => {
                    if (this.chatNames[chat.id] && !this.chatNames[chat.id].includes(botName))
                        this.chatNames[chat.id].push(botName);
                    if (this.bot.clusterMode)
                        this.bot.clusterMode.send({
                            topic: 'BotNameChangeAdd',
                            data: {
                                botName,
                                chatId: chat.id,
                            }
                        });
                    return message
                        .setTitleTemplate(command.messageTemplate.title, botName)
                        .send({
                            news: {
                                channel: this.newsChannel,
                                fromUser: message.user,
                            }
                        });
                });
        });
    }

    getNames(chat, message, command) {
        return ChatBotName.find({chatId: chat.id}).exec().then(docs => {
            let botNames = Array.isArray(this.bot.name) ? this.bot.name.slice() : [this.bot.name];
            docs.map((el) => botNames.push(el.botName));
            return message.setTitle(command.messageTemplate.title)
                .setBodyTemplate(command.messageTemplate.body, botNames).send();
        })
    }

    deleteName(chat, message, command) {
        let botName = message.getCommandArgs()[2].toLowerCase();
        return ChatBotName.findOne({chatId: chat.id, botName}).exec().then(doc => {
            if (!doc) return message.setTitleTemplate(command.messageTemplate.titleFail, botName).send();
            return doc.remove()
                .then(() => {
                    if (this.chatNames[chat.id] && this.chatNames[chat.id].includes(botName))
                        this.chatNames[chat.id].splice(this.chatNames[chat.id].indexOf(botName), 1);
                    return message
                        .setTitleTemplate(command.messageTemplate.title, botName)
                        .send({
                            news: {
                                channel: this.newsChannel,
                                fromUser: message.user,
                            }
                        });
                });
        })
    }

};
