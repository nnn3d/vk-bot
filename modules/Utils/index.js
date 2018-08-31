'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const CoreModuleEventController = require('../../classes/base/CoreModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const Fuse = require('fuse.js');

module.exports = class Utils extends ModuleEventController {

    /**
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            type: 'chat',
            commandList: {
                name: 'Дополнительно',
                description: 'дополнительные команды/возможности',
            },
            fuzzyCommand: {
                name: 'fuzzySearch',
                messageTemplate: {
                    fuzzyTitle: 'команда "#{0}" не найдена! возможно, имелась ввиду одна из команд:',
                    fuzzyBody: '• #{0}',
                },
            },
            commands: [
                // {
                //     name: 'clear',
                //     check: {
                //         args: /^чистка(?: (\d+))?$/i,
                //     },
                //     commandList: {
                //         name: 'чистка {количество последних сообщений}',
                //         description: 'удаляет последние сообщения бота в чате',
                //     },
                //     vip: {
                //         usages: 20,
                //     },
                // },
                {
                    name: 'update',
                    check: {
                        args: /^обновит?ь? чат$/i,
                    },
                    commandList: {
                        name: 'обновить чат',
                        description: 'обновляет данные о чате',
                    },
                    vip: {
                        usages: 10,
                    },
                    messageTemplate: {
                        text: 'данные чата успешно обновлены'
                    }
                },
                {
                    name: 'webPanel',
                    commandList: {
                        name: 'панель',
                        description: 'показывает ссылку на приложение веб панели бота',
                    },
                    check: 'панель',
                    execute: (chat, message, command) => {
                        return message
                            .setTitle('приложение веб панели в вк: vk.com/app6379472\nсайт веб панели: torchmet.ru')
                            .send({ chatSpamBan: {link: true} })
                    }
                },
                // {
                //     name: 'adminCommand',
                //     commandList: {
                //         name: 'админ чат',
                //         usage: 'админ чат (номер чата) (команда)',
                //     },
                //     check: {
                //         args: /^админ чат (\d+) (.+)$/i,
                //         admin: true,
                //     },
                //     messageTemplate: {
                //         pre: 'вывод команды "#{0}" из чата ##{1}:'
                //     }
                // }
            ],
        };
    }

    _init(bot) {
        this.activitys = {};
        this.messageMaxBodyLines = 5;
        this.messageEditTimes = 20;
        this.messageEditTimeout = 1000;
        this.lastMessages = {};
        this.lastMessagesMaxCount = 20;
        this.updateChatInfoPeriod = 30 * 6e4;
        this.updateChatInfoTimeout = setTimeout(() => this._updateChatInfo(), this.updateChatInfoPeriod);
        return super._init(bot).then(() => promiseFactory.allAsync([
            this.global.pre(this.eventNames.runCommand, this._onCommand, this),
            CoreModuleEventController.global.pre(this.eventNames.runCommand, this._onCommand, this),
            // this.bot.Message.global.middlewarePre(bot.Message.eventNames.sendInit, this._middlewarePreSendInit, this),
            this.bot.Message.global.after(bot.Message.eventNames.sendInit, this._afterSendInit, this),
            // this.global.after(this.eventNames.runCommand, this._afterCommand, this),
        ]))
    }

    _final() {
        clearTimeout(this.updateChatInfoTimeout);
        return super._final()
            .then(() => promiseFactory.allAsync([
                this.global.removeListenersPreByHandler(this.eventNames.runCommand, this),
                CoreModuleEventController.global.removeListenersPreByHandler(this.eventNames.runCommand, this),
                // this.bot.Message.global.removeMiddlewarePreByHandler(bot.Message.eventNames.sendInit, this),
                this.bot.Message.global.removeListenersAfterByHandler(bot.Message.eventNames.sendInit, this),
                // this.global.removeListenersAfterByHandler(this.eventNames.runCommand, this),
            ]));
    }

    _initChat(chat) {
        return super._initChat(chat).then(() =>
            chat.after(this.bot.eventNames.message, m => this._afterMessage(chat, m), this)
        )
    }

    _finalChat(chat) {
        return super._finalChat(chat).then(() =>
            chat.removeListenersAfterByHandler(this.bot.eventNames.message, this)
        )
    }

    _updateChatInfo() {
        let result = Promise.resolve();
        Object.keys(this.bot.chats).forEach(chatId => {
            if (this.bot.chats[chatId].type !== 'chat') return;
            result = result.then(() => {
                if (!this.bot.chats[chatId]) return;
                return this.bot.chats[chatId]._updateChatInfo();
            });
        });
        return result.catch(() => {}).then(() => {
            this.updateChatInfoTimeout = setTimeout(() => this._updateChatInfo(), this.updateChatInfoPeriod);
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    _onCommand(chat, message, command) {
        // if (!this.activitys[chat.id])
        // this.activitys[chat.id] = setInterval(() => {
        //     message.setActivity();
        // }, 5e3);
        message.utils = {
            runCommand: true,
        };
        return promiseFactory.allAsync([message.setActivity()], false);
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @private
     */
    _afterMessage(chat, message) {
        if ((message.isChat() && !this.bot.isBotName(message.getArgs()[0]))
            || message.utils && message.utils.runCommand || !chat.users.includes(message.user)
            || !chat || message.getText() || message.getCommandArgs().length === 0)
            return;
        return this.runCommand(chat, message, this.specification.fuzzyCommand)
    }

    // adminCommand(chat, message, command) {
    //     let [, chatId, commandText] = command.check.args.exec(message.getCommandText());
    //     let commandChat;
    //     let getChatPromise = Promise.resolve();
    //     if (this.bot.chats[chatId]) {
    //         commandChat = this.bot.chats[chatId];
    //     } else {
    //
    //     }
    // }

    fuzzySearch(chat, message, command) {
        let commands = [];
        chat.modules
            .map(module => {
                commands = commands.concat(
                    module.specification.commands
                        .filter(command => this.validateCommand(chat, message, command.check, false))
                        .map(command => {
                            if (!command.commandList || command.commandList.hidden) return false;
                            return {
                                out: command.commandList,
                                name: (command.commandList.usage || command.commandList.name)
                                    .replace(/({.+?}|\(.+?\))/g, '')
                            };
                        })
                        .filter(cl => cl)
                );
            });
        const options = {
            shouldSort: true,
            tokenize: true,
            includeScore: true,
            threshold: 0.6,
            location: 0,
            distance: 100,
            maxPatternLength: 32,
            minMatchCharLength: 3,
            keys: [
                "name",
            ],
        };
        let fuse = new Fuse(commands, options);
        let result = fuse.search(message.getCommandText());
        console.log('fuzzy search in chat', chat.id, 'find:', result.length, 'score:', result[0] && result[0].score);
        if (result.length && result[0].score < 0.8) return message.new
            .setTitleTemplate(command.messageTemplate.fuzzyTitle, message.getCommandText())
            .setBodyTemplate(
                command.messageTemplate.fuzzyBody,
                i => this.bot.getBotName() + ' ' + (result[i].item.out.usage || result[i].item.out.name)
            )
            .setTemplateLength(Math.min(result.length, 3))
            .send()
            .then(() => null);
        return null;
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    _afterCommand(chat, message, command) {
        // clearInterval(this.activitys[chat.id]);
    }

    /**
     *
     * @param {Object} params
     * @param {Message} message
     */
    _middlewarePreSendInit([params], message) {
        if (
            !(message._templateString && message._templateValues)
            || message._templateValues.length <= this.messageMaxBodyLines
            || message._templateLength <= this.messageMaxBodyLines
        ) return;
        message.utils = message.utils || {};
        message.utils.templateValues = message
            ._parseTemplate(message._templateString, message._templateValues, message._templateLength)
            .split('\n');
        message.utils.templateString = message._templateString;
        message.setTemplateLength(this.messageMaxBodyLines);
    }

    /**
     *
     * @param {Object} params
     * @param {Message} message
     */
    _afterSendInit(params, message) {
        let chatId = message.peer;
        if (chatId < 2e9) return;
        this.lastMessages[chatId] = this.lastMessages[chatId] || [];
        if (!this.lastMessages[chatId].includes(message)) this.lastMessages[chatId].push(message);
        if (this.lastMessages[chatId].length > this.lastMessagesMaxCount) this.lastMessages[chatId].shift();
        return;

        if (message.utils && message.utils.templateValues && message.utils.templateString) {
            let numEnd = 0;
            let numLength = this.messageMaxBodyLines;
            let values = message.utils.templateValues;
            let template = message.utils.templateString;
            let editTimes = 0;
            delete message._templateValues;
            let editMessage = () => {
                if (template !== message._templateString) return;
                if (++editTimes > this.messageEditTimes) {
                    message.setBody(values.join('\n'));
                    return message.edit();
                }
                if (numEnd >= values.length) numEnd = 0;
                numEnd += numLength;
                if (numEnd > values.length) numEnd = values.length;
                message.setBody(values.slice(numEnd - numLength, numEnd).join('\n'));
                console.log(numEnd);
                return message.edit().then(() => setTimeout(editMessage, this.messageEditTimeout));
            };
            setTimeout(editMessage, this.messageEditTimeout);
        }
    }

    update(chat, message, command) {
        return chat._updateChatInfo().then(() => {
            return message.setTitle(command.messageTemplate.text).send()
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    clear(chat, message, command) {
        let chatId = chat.id;
        if (!this.lastMessages[chatId]) return;
        let [, count] = command.check.args.exec(message.getCommandText());
        if (count) count = Math.min(+count, this.lastMessages[chatId].length);
        else count = this.lastMessages[chatId].length;
        let lastMessages = this.lastMessages[chatId].slice(-count);
        this.lastMessages[chatId] = this.lastMessages[chatId].slice(0, -count);
        return promiseFactory.allSync(lastMessages.map(message => () => message.delete()));
    }

};
