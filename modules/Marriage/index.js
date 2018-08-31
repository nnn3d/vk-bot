'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const MarriageModel = require('./Marriage');

module.exports = class Marriage extends ModuleEventController {

    constructor() {
        super();
        this.newsChannel = 'браки'
    }

    /**
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            type: 'chat',
            commandList: {
                name: 'Браки',
                description: 'Позволяет заключать "браки" внутри чата',
            },
            web: {
                icon: {
                    name: 'FaVenusMars',
                    options: {
                        color: '#cac75e',
                    }
                },
            },
            commands: [
                {
                    name: 'getMarried',
                    check: /^брак(?: с)? ([a-zа-яё]+ ?[a-zа-яё]*|\d+)$/i,
                    commandList: {
                        name: 'брак',
                        usage: 'брак (имя пользователя)',
                        description: 'брак {(имя [ + фамилия]) или (id)} - заключает брак с кем либо',
                    },
                    vip: {
                        usages: 10,
                    },
                    messageTemplate: {
                        title: `теперь #{0} и #{1} в счастливом браке!`,
                        titleQuestion: `#{0}, готовы ли вы вступить в брак с #{1}? ("да" или "нет")`,
                        timeoutFail: `#{0}, время для ответа вышло!`,
                        fuckYouFail: `#{0}, тебе не повезло - #{1} не хочет с тобой в брак!`,
                        userFail: `Пользователь #{0} не найден`,
                        marriageFail: `#{0} уже состоит в счастливом браке с #{1}`,
                        multiFail: `Ваш запрос на брак уже обрабатывается!`,
                    }
                },
                {
                    name: 'showMarriage',
                    check: /^браки$/i,
                    commandList: {
                        name: this.newsChannel,
                        description: 'показывает браки в этой беседе',
                    },
                    messageTemplate: {
                        title: `браки в этой беседе:`,
                        body: `#{0} и #{1} (#{2} дн.)`,
                        fail: `в беседе пока нет браков`,
                    },
                    web: {
                        output: this.newsChannel,
                    }
                },
                {
                    name: 'divorce',
                    check: /^развод$/i,
                    commandList: {
                        name: 'развод',
                        description: 'расторгает ранее заключенный брак',
                    },
                    messageTemplate: {
                        title: `брак между #{0} и #{1} теперь не действителен`,
                        fail: `вы пока не в браке :)`,
                    },
                    web: {
                        type: 'action',
                        submitText: 'развод',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'showMarriage',
                                'divorce',
                            ],
                        },
                        hidden: (props, chat, message) => MarriageModel.findOne({
                            $or: [
                                { userId1: message.user },
                                { userId2: message.user },
                            ],
                            chatId: chat.id,
                        }).then(doc => !doc),
                    }
                },
            ]
        };
    }

    /**
     *
     * @param {Bot} bot
     * @return {Promise.<*>}
     * @private
     */
    _init(bot) {
        this.marriage = {};
        return super._init(bot).then(() => this.bot.middlewareOn('CommandList.getUserInfo', this._getUserInfo, this));
    }

    /**
     *
     * @param {Chat} chat
     */
    _initChat(chat) {
        this.marriage[chat.id] = {};
        return super._initChat(chat);
        // return this._checkMarriage(chat)
        //     .then(() => super._initChat(chat))
        //     .then(() => {
        //         return chat.on(chat.eventNames['chat.kick'], info => this._onKick(chat, info), this);
        //     });
    }

    /**
     *
     * @param {Chat} chat
     */
    _finalChat(chat) {
        return super._finalChat(chat).then(() => {
            return chat.removeListenersOnByHandler(chat.eventNames['chat.kick'], this);
        });
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
        return MarriageModel.findOne({
            $or: [
                { userId1: userId },
                { userId2: userId },
            ],
            chatId: chat.id,
        }).then(doc => {
            if (doc && chat.users.includes(doc.userId1) && chat.users.includes(doc.userId2)) {
                let partnerId = userId === doc.userId1 ? doc.userId2 : doc.userId1;
                info.push(`состоит в счастливом браке с ${chat.userNames[partnerId].fullName}`);
            } else info.push(`не состоит в браке`);
        })
    }

    /**
     *
     * @param {Chat} chat
     */
    _checkMarriage(chat) {
        let promises = [];
        return MarriageModel.find({ chatId: chat.id }).exec()
            .then(docs => {
                for (let doc of docs) {
                    if (!chat.users.includes(doc.userId1) || !chat.users.includes(doc.userId2)) {
                        promises.push(doc.remove());
                    }
                }
            })
            .then(() => promiseFactory.allAsync(promises));
    }

    /**
     *
     * @param {Chat} chat
     * @param {Object} info
     */
    _onKick(chat, info) {
        return MarriageModel.remove({
            $or: [
                { userId1: info.kick },
                { userId2: info.kick },
            ],
            chatId: chat.id,
        }).exec();
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    getMarried(chat, message, command) {
        let info = command.check.exec(message.getCommandText());
        let nameOrId = info[1];
        let userId, userName;
        let fromId = message.user;
        let fromName = `${chat.userNames[fromId].fullName}`;
        userId = chat.findUser(nameOrId);
        if (userId === fromId) return;
        if (!userId) return message.setTitleTemplate(command.messageTemplate.userFail, nameOrId).send();
        userName = `${chat.userNames[userId].fullName}`;
        if (userId in this.marriage[chat.id] || fromId in this.marriage[chat.id]) {
            let id = this.marriage[chat.id][fromId] || this.marriage[chat.id][userId];
            return message.createReply().createReply(id)
                .setTitle(command.messageTemplate.multiFail).send();
        }
        this.marriage[chat.id][userId] = message.id;
        this.marriage[chat.id][fromId] = message.id;
        return MarriageModel.findOne({
            $or: [
                { userId1: userId },
                { userId2: userId },
                { userId1: fromId },
                { userId2: fromId },
            ],
            chatId: chat.id,
        }).then(doc => {
            let timeout;
            let answerFunc;
            let stopFunc = () => {
                clearTimeout(timeout);
                delete this.marriage[chat.id][userId];
                delete this.marriage[chat.id][fromId];
                return chat.removeListenerOn(chat.eventNames.message, answerFunc)
            };
            if (doc) {
                if (chat.users.includes(doc.userId1) && chat.users.includes(doc.userId2)) {
                    return message.setTitleTemplate(command.messageTemplate.marriageFail,
                        `${chat.userNames[doc.userId1].fullName}`,
                        `${chat.userNames[doc.userId2].fullName}`)
                        .send()
                        .then(stopFunc);
                }
            }
            answerFunc = (message) => {
                if (message.user !== userId) return;
                if (/^нет( |$)/i.test(message.text)) {
                    return stopFunc()
                        .then(() => message.setTitleTemplate(command.messageTemplate.fuckYouFail, fromName, userName).send());
                }
                if (!/^да( |$)/i.test(message.text)) return;
                stopFunc().then(() => {
                    let result = Promise.resolve();
                    if (doc) result = doc.remove();
                    return result.then(
                        () => new MarriageModel({
                            chatId: chat.id,
                            userId1: fromId,
                            userId2: userId,
                            time: Date.now(),
                        }).save()
                    );
                }).then(() => {
                    message.setTitleTemplate(command.messageTemplate.title, fromName, userName)
                        .send({ news: this.newsChannel });
                });
            };
            return message.setTitleTemplate(command.messageTemplate.titleQuestion,
                `[id${userId}|${userName}]`, `[id${fromId}|${fromName}]`)
                .send()
                .then(id => {
                    this.marriage[chat.id][userId] = id;
                    this.marriage[chat.id][fromId] = id;
                })
                .then(() => {
                    timeout = setTimeout(() => {
                        let id = this.marriage[chat.id][fromId] || this.marriage[chat.id][userId];
                        chat.emit('News.add', userId, `[id${fromId}|${chat.userNames[fromId].fullName}] хотел вступить в брак с вами`);
                        stopFunc().then(
                            () => message.new.createReply(id)
                                .setTitleTemplate(command.messageTemplate.timeoutFail, `${userName}`).send()
                        );

                    }, 60000)
                })
                .then(() => {
                    return chat.on(chat.eventNames.message, answerFunc, this);
                })
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showMarriage(chat, message, command) {
        return MarriageModel.find({ chatId: chat.id }).exec().then(docs => {
            docs = docs.filter((doc) => {
                if (!chat.users.includes(doc.userId1) || !chat.users.includes(doc.userId2)) {
                    return false;
                }
                return true;
            });
            if (!docs.length) return message.setTitle(command.messageTemplate.fail).send();
            let time = Date.now();
            docs.sort((a, b) => a.time - b.time);
            return message.setTitle(command.messageTemplate.title)
                .setBodyTemplate(command.messageTemplate.body,
                    i => `${chat.userNames[docs[i].userId1].fullName}`,
                    i => `${chat.userNames[docs[i].userId2].fullName}`,
                    i => Math.ceil((time - docs[i].time) / (24 * 36e5)))
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
    divorce(chat, message, command) {
        return MarriageModel.findOne({
            $or: [
                { userId1: message.user },
                { userId2: message.user },
            ],
            chatId: chat.id,
        }).then(doc => {
            if (doc && (!chat.users.includes(doc.userId1) || !chat.users.includes(doc.userId2))) {
                doc.remove();
                doc = undefined;
            }
            if (!doc) return message.setTitle(command.messageTemplate.fail).createReply().send();
            let fromUserId = message.user === doc.userId1 ? doc.userId1 : doc.userId2;
            let toUserId = message.user === doc.userId1 ? doc.userId2 : doc.userId1;
            chat.emit('News.add', toUserId, `[id${fromUserId}|${chat.userNames[fromUserId].fullName}] разорвал брак с вами`);
            return doc.remove()
                .then(() => {
                    return message.setTitleTemplate(command.messageTemplate.title,
                        `[id${doc.userId1}|${chat.userNames[doc.userId1].fullName}]`,
                        `[id${doc.userId2}|${chat.userNames[doc.userId2].fullName}]`)
                        .send({ news: this.newsChannel })
                });
        })
    }

};
