'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const ChatCommunicationStatus = require('./ChatCommunicationStatus');
const UserCommunicationCount = require('./UserCommunicationStatus');

module.exports = class Communication extends ModuleEventController {

    constructor() {
        super();
        this.applications = {};
        this.chatVotes = {};
        this.timeToVote = 2;
    }

    /**
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            commandList: {
                name: 'Связи',
                description: 'Позволяет коммуницировать с другими чатами бота',
            },
            commands: [
                {
                    name: 'addToChat',
                    check: {
                        args: /^хочу в (чат|бесед)/i,
                    },
                    commandList: {
                        name: 'хочу в чат',
                        description: `добавляет в один из чатов бота на выбор, если участники чата захотят вас принять`,
                    },
                    messageTemplate: {
                        titleFail: `нет чатов, в которых можно вас добавить :(`,
                        applicationFail: `ваша заявка уже обрабатывается!`,
                        timeoutFail: `время для выбора вышло!`,
                        friendFail: 'для этой команды вы должны быть у бота в друзьях!',
                        toDmTitle: `запрос отправлен вам в лс!`,
                        chatsTitle: `выберите чат для продолжения (введите № чата):`,
                        chatsBody: `№#{0}. чат "#{1}", участников: #{2}`,
                        chatsEnd: `команда 'еще чаты' покажет больше чатов`,
                        wait: `запрос отправлен, в чате №#{0} идет голосование... (#{1} мин.)`,
                        done: `поздравляю, вас приняли в чат №#{0}!`,
                        fail: `к сожалению, вас не приняли в чат №#{0}`,
                        error: `к сожалению, в чате №#{0} никто не проголосовал, попробуйте снова позднее, или запустите команду еще раз для выбора другого чата`,
                    },
                    vip: {
                        usages: 5,
                    }
                },
                {
                    name: 'changeChatStatus',
                    check: {
                        args: /(не )?принимать заявки/i,
                        type: 'chat',
                    },
                    commandList: {
                        name: 'изменить статус приема заявок',
                        usage: `('не принимать' или 'принимать') заявки`,
                        description: `'принимать заявки' - разрешает, 'не примимать заявки' запрещает пользователям отправлять заявки на добавление в чат`,
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        titleTrue: `теперь чат открыт для заявок!`,
                        titleFalse: `теперь чат не принимает заявки!`,
                    }
                },
                {
                    name: 'addToChatVote',
                    check: {
                        args: /^голосую (?:(за)|(против))/i,
                        type: 'chat',
                    },
                    chatSpamBan: {
                        immunity: true,
                    },
                    commandList: {
                        hidden: true,
                        name: 'голосование за или против приема заявки',
                        usage: `голосую {'за' или 'против'}`,
                    },
                    commandAccess: {
                        defaultStatus: 1,
                    },
                    messageTemplate: {
                        startVote: `пользователь [id#{0}|#{1}] хочет присоединиться к вашей беседе!
пишите 'голосую за' или 'голосую против', голосование закончится через ${this.timeToVote} мин.
при равном количестве голосов "за" и "против" пользователь не добавляется
(если вы не хотите больше получать такие заявки, используйте команду 'не принимать заявки')`,
                        endVote: `голосование завершено!
голосов за: #{0}, голосов против: #{1}`,
                        endYes: `пользователь [id#{0}|#{1}] будет принят в беседу`,
                        endNo: `пользователь [id#{0}|#{1}] не принят в беседу`,
                    }
                },
                {
                    name: 'createChat',
                    check: {
                        args: 'создай чат',
                        type: 'dm',
                        admin: true,
                    },
                    commandList: {
                        name: 'создай чат',
                        description: 'создает новый пустой чат, в котором бот - админ',
                        hidden: true,
                    },
                    vip: {
                        usages: 2,
                    },
                    messageTemplate: {
                        title: 'чат №#{0} успешно создан!',
                        titleFail: 'что то пошло не так, мне не удалось создать новый чат...',
                        friendFail: 'для этой команды вы должны быть у бота в друзьях!',
                    },
                },
            ]
        };
    }

    _init(bot) {
        process.on('message', packet => {
            if (packet && packet.topic === 'communicationAddToChat') {
                if (this.bot.clusterMode && this.bot.clusterMode.isClusterChat(packet.data)) return;
                let command = this.specification.commands.filter(command => command.name === 'addToChat')[0];
                if (!command) return;
                let message = new this.bot.Message({ peer: packet.data, user: packet.data });
                let chat = this.bot.chats[packet.data];
                let result = Promise.resolve();
                if (!chat) {
                    result = result.then(() => {
                        return this.bot.createChat(packet.data);
                    }).then(newChat => chat = newChat);
                }
                return result.then(() => this.addToChat(chat, message, command));
            }
        });
        return super._init(bot);
    }

    /**
     *
     * @param {Chat} fromChat
     * @param {Chat} toChat
     * @param {Number} userId
     * @param {String} userFullName
     * @returns {Promise}
     * @private
     */
    _addToChat(fromChat, toChat, userId, userFullName) {
        let commandName = 'addToChatVote';
        /**
         * @type {SpecificationCommand}
         */
        let command;
        for (let c of this.specification.commands) {
            if (c.name === commandName) command = c;
        }
        if (!command)
            throw new Error(`cant find command ${commandName} in addToChat in module ${this.specification.name}`);
        return new Promise((resolve, reject) => {
            let votesYes = [];
            let votesNo = [];
            let onEnd = () => {
                return toChat.removeListenersOnByHandler(toChat.eventNames.message, this).then(() => {
                    let result = votesYes.length > votesNo.length;
                    let template = result ? command.messageTemplate.endYes : command.messageTemplate.endNo;
                    console.log('votes: ', votesYes, votesNo);
                    new this.bot.Message({ peer: toChat.id })
                        .setTitleTemplate(command.messageTemplate.endVote, votesYes.length, votesNo.length)
                        .setEndTemplate(template, userId, userFullName)
                        .send()
                        .then(() => {
                            if (!result) return reject(votesYes.length + votesNo.length === 0);
                            this.bot.vk.api.messages.addChatUser({ user_id: userId, chat_id: toChat.id - 2e9 })
                                .then(resolve)
                                .catch(reject);
                        })
                })
            };
            /**
             *
             * @param {Chat} chat
             * @param {Message} checkMessage
             * @param {SpecificationCommand} command
             */
            command.execute = (chat, checkMessage, command) => {
                if (votesYes.includes(checkMessage.user) || votesNo.includes(checkMessage.user)) return;
                if (command.check.args.exec(checkMessage.getCommandText())[1]) votesYes.push(checkMessage.user);
                else votesNo.push(checkMessage.user);
            };
            toChat.on(toChat.eventNames.message, (message) => {
                if (this.validateCommand(toChat, message, command.check)) {
                    return this.runCommand(toChat, message, command);
                }
            }, this)
                .then(() => {
                    setTimeout(onEnd, this.timeToVote * 6e4);
                    return new this.bot.Message({ peer: toChat.id })
                        .setTitleTemplate(command.messageTemplate.startVote, userId, userFullName).send();
                }).catch(console.error);
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    addToChat(chat, message, command) {
        let chats = {};
        let userId = message.user;
        let result = Promise.resolve();
        if (chat.type === 'chat') {
            result = message.createReply()
                .setTitle(command.messageTemplate.toDmTitle)
                .send()
                .then(() => message.peer = userId);
            if (this.bot.clusterMode && this.bot.clusterMode.isClusterChat(userId)) {
                return this.bot.clusterMode.send({
                    topic: 'communicationAddToChat',
                    data: userId,
                });
            }
            if (userId in this.bot.chats) {
                chat = this.bot.chats[userId];
            } else {
                result = result.then(() => {
                    return this.bot.createChat(userId);
                }).then(newChat => chat = newChat);
            }
        } else {
            message.peer = chat.id;
        }
        result = result
            .then(() => {
                return this.bot.vk.api.friends.areFriends({user_ids: userId})
                    .then(friendsInfo => {
                        if (friendsInfo[0].friend_status !== 3) {
                            return message.new.createReply().setTitle(command.messageTemplate.friendFail).send()
                                .then(() => {
                                    throw `user ${userId} not friend (command 'addToChat' module 'Communication')`;
                                });
                        }
                    });
            })
            .then(() => {
                if (this.applications[userId])
                    return message.new.createReply(this.applications[userId])
                        .setTitle(command.messageTemplate.applicationFail).send()
                        .then(() => {
                            throw `user ${userId} already choose chat (command 'addToChat' module 'Communication')`;
                        });
                else this.applications[userId] = message.id;
            });
        for (let chat of this.chats) {
            if (chat.type === 'chat'
                && !chat.users.includes(userId)
                && chat.users.length < 240)
                chats[chat.id] = chat;
        }
        let countChatsToShow = 15;
        return result.then(() => ChatCommunicationStatus.find({ chatId: { $in: Object.keys(chats) } }).exec().then(docs => {
            docs.map(doc => (!doc.status && doc.chatId in chats) && delete chats[doc.chatId]);
            return UserCommunicationCount.find({ userId, chatId: { $in: Object.keys(chats) } }).exec().then(docs => {
                docs.map(doc => (doc.chatId in chats && (doc.resolve || doc.ban)) && delete chats[doc.chatId]);
                let availableChats = Object.keys(chats).map(id => chats[id]);
                if (!availableChats.length) {
                    this.applications[userId] = undefined;
                    return message.setTitle(command.messageTemplate.titleFail).send();
                }
                let i = availableChats.length;
                while (0 <= --i) {
                    let randomI = Math.floor(Math.random() * i);
                    [availableChats[i], availableChats[randomI]] = [availableChats[randomI], availableChats[i]];
                }
                let pageNum = 0;
                let status = false;
                let timeout = 1e5;
                let onMessage;
                let stopFun = () => {
                    this.applications[userId] = undefined;
                    chat.removeListenerOn(chat.eventNames.message, onMessage);
                    message.new.createReply(message.id).setTitle(command.messageTemplate.timeoutFail).send();
                };
                let stopTimeout = setTimeout(stopFun, timeout);
                let showChats = () => {
                    let showChats = availableChats.slice(countChatsToShow * pageNum, countChatsToShow * (++pageNum));
                    if (!showChats.length) return;
                    clearTimeout(stopTimeout);
                    stopTimeout = setTimeout(stopFun, timeout);
                    message.new.setTitle(command.messageTemplate.chatsTitle)
                        .setBodyTemplate(command.messageTemplate.chatsBody,
                            n => showChats[n].id - 2e9,
                            n => showChats[n].title.replace('.', ''),
                            n => showChats[n].users.length)
                        .setTemplateLength(showChats.length);
                    if (availableChats.length > countChatsToShow * pageNum)
                        message.setEnd(command.messageTemplate.chatsEnd);
                    return message.send();
                };
                onMessage = checkMessage => {
                    if (checkMessage.user !== userId || status) return;
                    if (/^.?[её]щ[её] чат/i.test(checkMessage.getCommandText())) {
                        return showChats();
                    } else {
                        let info = /^\D?(\d+)\D?$/.exec(checkMessage.getCommandArgs()[0]) || [];
                        let chatId = 2e9 + +info[1];
                        if (isNaN(chatId) || !(chatId in chats)) return;
                        clearTimeout(stopTimeout);
                        status = true;
                        return chat.removeListenerOn(chat.eventNames.message, onMessage).then(() => {
                            let findInfo = { chatId, userId };
                            let updateInfo = {
                                $inc: { count: 1 },
                                $set: { lastAttempt: Date.now() },
                            };
                            let optionsInfo = {
                                upsert: true,
                                setDefaultsOnInsert: true,
                            };
                            if (!this.chatVotes[chatId]) this.chatVotes[chatId] = Promise.resolve();
                            this.chatVotes[chatId] = this.chatVotes[chatId].then(() => {
                                return this._addToChat(chat, chats[chatId], userId,
                                    `${chat.userNames[userId].name} ${chat.userNames[userId].secondName}`)
                                    .then(() => {
                                        updateInfo.$set.resolve = true;
                                        return UserCommunicationCount
                                            .findOneAndUpdate(findInfo, updateInfo, optionsInfo).exec()
                                            .then(() => {
                                                this.applications[userId] = undefined;
                                                message.new
                                                    .setTitleTemplate(command.messageTemplate.done, chatId - 2e9)
                                                    .send();
                                            }).catch(console.error);
                                    })
                                    .catch(error => {
                                        let template = command.messageTemplate.error;
                                        if (!error) {
                                            updateInfo.$set.ban = true;
                                            template = command.messageTemplate.fail;
                                        } else if (error instanceof Error) {
                                            console.error(error);
                                        }
                                        return UserCommunicationCount
                                            .findOneAndUpdate(findInfo, updateInfo, optionsInfo).exec()
                                            .then(() => {
                                                this.applications[userId] = undefined;
                                                message.new
                                                    .setTitleTemplate(template, chatId - 2e9)
                                                    .send();
                                            }).catch(console.error);
                                    });
                            });
                            return message.new
                                .setTitleTemplate(command.messageTemplate.wait, chatId - 2e9, this.timeToVote)
                                .send();
                        });
                    }
                };
                return chat.on(chat.eventNames.message, onMessage).then(showChats);
            })
        }));
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    changeChatStatus(chat, message, command) {
        let result = !command.check.args.exec(message.getCommandText())[1];
        let template = result ? command.messageTemplate.titleTrue : command.messageTemplate.titleFalse;
        return ChatCommunicationStatus.findOneAndUpdate(
            { chatId: chat.id },
            { status: result },
            { upsert: true }
        ).exec().then(() => {
            return message.setTitle(template).send();
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    createChat(chat, message, command) {
        let userId = chat.type === 'dm' ? chat.id : message.user;
        return this.bot.vk.api.friends.areFriends({ user_ids: userId })
            .then(friendsInfo => {
                if (friendsInfo[0].friend_status !== 3) {
                    return message.createReply().setTitle(command.messageTemplate.friendFail).send();
                }
                let adminId = this.bot.admins[0];
                if (!adminId) throw 'no admins to createChat (module Communication)';
                let users = [this.bot.selfId, userId, adminId];
                let chatId;
                return this.bot.ctrlEmit((users) => {
                    return this.bot.vk.api.messages.createChat({
                        user_ids: users.join(',')
                    })
                        .then(result => {
                            chatId = result;
                            return this.bot.vk.api.messages.removeChatUser({
                                chat_id: chatId,
                                member_id: adminId,
                                v: '5.81'
                            })
                        })
                        .then(() => {
                            if (users.includes(adminId)) users.splice(users.indexOf(adminId), 1);
                            return message.setTitleTemplate(command.messageTemplate.title, chatId).send();
                        })
                        .catch(error => {
                            return message.setTitle(command.messageTemplate.titleFail).send()
                                .then(() => { throw error });
                        })
                        .then(() => chatId + 2e9)
                }, this.eventNames.createVkChat, users);
            })
    }

    get eventNames() {
        return Object.assign(super.eventNames, {
            createVkChat: 'createVkChat',
        })
    }
};
