'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');


module.exports = class ChatSpamBan extends ModuleEventController {

    /**
     * @typedef {Object} SpecificationCommand_ChatSpamBan
     * @property {Boolean} immunity if true, module not ban
     */

    constructor({ spamUsers = [] } = {}) {
        super();
        this.spamUsers = [].concat(spamUsers);
    }

    /**
     *
     * @return {Specification}
     */
    moduleSpecification() {
        return {
            type: 'chat',
            vip: {
                free: true,
            },
        };
    }

    _init(bot) {
        return super._init(bot).then(() => {
            this.chatCount = {};
            this.chatBanStatus = {};
            this.chatBanTimes = {};
            this.unbanTimers = [];
            this.maxCommandsPerMinute = 4;
            this.banTimeMinutes = 0.5;
            this.maxBanMinutes = 4;
            this.messageDelay = 300;
            this.messageDelayPromise = Promise.resolve();
            setInterval(() => this.messageDelayPromise = Promise.resolve(), 6e4);
            this.clearCountsInterval = setInterval(this._clearCounts.bind(this), 3e4);
            this.clearTimesInterval = setInterval(this._clearTimes.bind(this), 36e5);
            return promiseFactory.allAsync([
                this.bot.pre(this.bot.eventNames.message, this._checkSpamUser, this),
                this.global.pre(this.eventNames.runCommand, this._check, this),
                this.global.middlewarePre(this.eventNames.runCommand, this._middlewarePre, this),
                this.bot.Message.global.middlewareOn(this.bot.Message.eventNames.send, this._middlewareOnMessage, this),
                this.bot.Chat.global.pre(this.bot.Chat.eventNames.addUser, userId => {
                    if (this.spamUsers.includes(userId)) throw `don't add spam user (${userId})`;
                }, this),
            ]);
        });
    }

    _final() {
        return super._final().then(() => promiseFactory.allAsync([
            this.global.removeListenersPreByHandler(this.eventNames.runCommand, this).then(() => {
                clearInterval(this.clearCountsInterval);
                clearInterval(this.clearTimesInterval);
            }),
            this.bot.removeListenersPreByHandler(this.bot.eventNames.message, this),
            this.global.removeMiddlewarePreByHandler(this.eventNames.runCommand, this),
            this.bot.Message.global.removeMiddlewareOnByHandler(this.bot.Message.eventNames.send, this),
            this.bot.Chat.global.removeListenersPreByHandler(this.bot.Chat.eventNames.addUser, this),
        ]));
    }

    _clearCounts() {
        for (let chatId of Object.getOwnPropertyNames(this.chatCount)) {
            this.chatCount[chatId] = 0;
        }
    }

    _clearTimes() {
        for (let chatId of Object.getOwnPropertyNames(this.chatCount)) {
            this.chatBanTimes[chatId] = 1;
        }
    }

    _middlewarePre(args) {
        let chat = args[0];
        if (!chat.modules.includes(this)) return;
        let message = args[1];
        let command = args[2];
        if (command.chatSpamBan && command.chatSpamBan.immunity) return;
        if (this.chatBanStatus[chat.id]) {
            return message.pre(message.eventNames.send, () => {throw `Chat ${chat.id} is temporarily banned`})
        }
    }

    _middlewareOnMessage([params], message) {
        // let result = this.messageDelayPromise;
        // let replaceFrom = ["С", "с", "Е", "е", "Т", "О", "о", "р", "Р", "А", "а", "Н", "К", "Х", "х", "В", "М", " "      ];
        // let replaceTo   = ["C", "c", "E", "e", "T", "O", "o", "p", "P", "A", "a", "H", "K", "X", "x", "B", "M", "&#8194;"];

        if (!params.chatSpamBan || !params.chatSpamBan.replaced) {
            let replaceFrom = ["С", "с", "Е", "е", "Т", "О", "о", "р", "Р", "А", "а", "Н", "К", "Х", "х", "В", "М"];
            let replaceTo   = ["C", "c", "E", "e", "T", "O", "o", "p", "P", "A", "a", "H", "K", "X", "x", "B", "M"];
            let allReplaceFrom = replaceFrom.concat(replaceTo);
            let allReplaceTo = replaceTo.concat(replaceFrom);
            if (!params.chatSpamBan || !params.chatSpamBan.link) {
                params.message = params.message
                    .replace(/(?:\.|&#46;)\s*.?\s*(?:ru|net|org|com|pe|mix|opt|cc|gl|рф)/ig, '')
                    .replace(/(?:\.|&#46;)([a-zа-яё])/ig, '. $1')
                    .replace(/&(#1\d{1,2};)/ig, '& $1')
                    .replace(/v[тt][oо0].{0,3}[pр][еe]/ig, '')
                    .replace(/v[kк][bбв][oо0][тt].{0,3}[rг][uиyу]/ig, '')
                    .replace(/[li1][i1l][kк][eеё][s$][тt].{0,3}[rг][uиyу]/ig, '')
                    .replace(/[vw][i1l][i1l][kк][aа].{0,3}[rг][uиyу]/ig, '')
                    .replace(/подарки-голоса/ig, '')
                    .replace(/микс/ig, '')
                    .replace(/спайс/ig, '')
                    .replace(/соли/ig, '')
                    .replace(/903(\s*|-)12(\s*|-)12(\s*|-)31/ig, '')
                    .replace(/#([^\d])/ig, '№$1')
                    .replace(new RegExp(`(${allReplaceFrom.join('|')})`, 'g'), (match, char) => {
                        return allReplaceTo[allReplaceFrom.indexOf(char)];
                    });
            } else {
                params.message = params.message
                    .replace(new RegExp(`(${replaceFrom.join('|')})`, 'g'), (match, char) => {
                        if (Math.round(Math.random())) return replaceTo[replaceFrom.indexOf(char)];
                        return char;
                    });
            }
            params.chatSpamBan = params.chatSpamBan || {};
            params.chatSpamBan.replaced = true;
        }
        // params.message = params.message.replace(' ', '&#8194');
        // if (!params.forward_messages)
            // params.forward_messages = message.id;
        // this.messageDelayPromise = this.messageDelayPromise
        //     .then(() => new Promise(resolve => setTimeout(resolve, this.messageDelay)));
        // return result.then(() => [params]);
    }

    _checkSpamUser(event) {
        let user = event.user;
        if (this.spamUsers.includes(user)) {
            throw 'spam user dont run command';
        }
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     * @param {ModuleEventController} module
     * @return {Promise.<*>|undefined}
     * @private
     */
    _check(chat, message, command, module) {
        if (!chat.modules.includes(this)) return;
        if (command.chatSpamBan && command.chatSpamBan.immunity) return;
        if (this.spamUsers.includes(message.user)) {
            throw 'spam user dont run command';
        }
        if (!(chat.id in this.chatCount)) {
            this.chatCount[chat.id] = 0;
            this.chatBanStatus[chat.id] = false;
            this.chatBanTimes[chat.id] = 1;
        }
        if (this.chatBanStatus[chat.id]) {
            throw `Chat ${chat.id} is temporarily banned`;
        }
        this.chatCount[chat.id]++;
        let count = Math.min(this.chatBanTimes[chat.id] * this.banTimeMinutes, this.maxBanMinutes);
        if (command.vip && command.vip.status) count = this.banTimeMinutes;
        let countText = count > 1 ? `${Math.round(count)} мин.` : `${Math.round(count * 60)} сек.`;
        if (this.chatCount[chat.id] >= this.maxCommandsPerMinute) {
            let id;
            this.chatBanStatus[chat.id] = true;
            console.log('chat ', chat.id, ' ban to ', count, ' minutes');
            let unbanTimer = setTimeout(() => {
                this.chatBanTimes[chat.id] *= 2;
                this.chatCount[chat.id] = 0;
                this.chatBanStatus[chat.id] = false;
                message.new.setTitle('Я снова тут!');
                if (id) message.createReply(id);
                message.send();
                console.log('chat ', chat.id, ' unban');
            }, count * 60 * 1000);
            this.unbanTimers.push(unbanTimer);
            let immunityCommands = this._getImmunityCommands(chat);
            let title = `Слишком много обращений за последнее время, удаляюсь на ${countText}`;
            title += immunityCommands.length && `\nКоманды, которые все еще можно использовать:` || '';
            return message.new.setTitle(title)
                .setBodyTemplate('#{0}', immunityCommands).send()
                .then(messageId => id = messageId)
                .then(() => {throw `Chat ${chat.id} is temporarily banned`});
        }
    }

    _getImmunityCommands(chat) {
        let commands = [];
        for (let module of chat.modules) {
            for (let command of module.specification.commands) {
                if (!(command.chatSpamBan && command.chatSpamBan.immunity)) continue;
                let commandName = (command.commandList && (command.commandList.name || command.commandList.usage))
                    || command.name;
                let moduleName = (module.specification.commandList && (module.specification.commandList.name || module.specification.commandList.usage))
                    || module.specification.name;
                commands.push(`➛ ${commandName} (${moduleName})`);
            }
        }
        return commands;
    }

};
