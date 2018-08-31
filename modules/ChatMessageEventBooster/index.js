'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');

module.exports = class ChatMessageEventBooster extends ModuleEventController {

    _init(bot) {
        this.bot = bot;
        this.chatCommandListeners = {};
        return promiseFactory.allAsync([
            this.bot.pre(this.bot.eventNames.newListenerOn, this._preNewListener, this),
            this.bot.on(this.bot.eventNames.message, this._onMessage, this),
            this.bot.Chat.global.pre(this.bot.Chat.eventNames.newListenerOn, this._preNewChatListener, this),
            this.bot.Chat.global.on(this.bot.Chat.eventNames.message, this._onChatMessage, this),
            this.bot.Chat.global.pre(this.bot.Chat.eventNames.init, this._onChatFinal, this),
            this.bot.Chat.global.on(this.bot.Chat.eventNames.final, this._onChatFinal, this),
        ]);
    }

    _final() {
        return promiseFactory.allAsync([
            this.bot.removeListenersPreByHandler(this.bot.eventNames.newListenerOn, this),
            this.bot.removeListenersOnByHandler(this.bot.eventNames.message, this),
            this.bot.Chat.global.removeListenersPreByHandler(this.bot.eventNames.newListenerOn, this),
            this.bot.Chat.global.removeListenersOnByHandler(this.bot.eventNames.message, this),
            this.bot.Chat.global.removeListenersPreByHandler(this.bot.eventNames.init, this),
            this.bot.Chat.global.removeListenersOnByHandler(this.bot.eventNames.final, this),
        ]);
    }

    /**
     *
     * @param {EventInfo} eventInfo
     * @private
     */
    _preNewListener(eventInfo) {
        if (eventInfo.eventName === this.bot.eventNames.message && eventInfo.handler instanceof this.bot.Chat) {
            throw `don't need new listener to bot from chat, just boost it!`;
        }
    }

    _preNewChatListener(eventInfo, chat) {
        if (chat && eventInfo.eventName === chat.eventNames.message
            && eventInfo.listener.name.endsWith('runCommandByMessage')) {
            if (!this.chatCommandListeners[chat.id]) this.chatCommandListeners[chat.id] = [];
            this.chatCommandListeners[chat.id].push(eventInfo);
            throw `don't need new runCommandByMessage listener to chat, just boost it!`;
        }
    }

    _onChatFinal(chat) {
        if (chat) delete this.chatCommandListeners[chat.id];
    }

    _onMessage(message) {
        let id = message.peer || message.chat + 2e9;
        if (!isNaN(id) && this.bot.chats[id])
            return this.bot.chats[id].onAll(this.bot.eventNames.message, message);
    }

    _onChatMessage(message, chat) {
        if (chat.type !== 'chat' || this.bot.isBotName(message.getArgs()[0])) {
            return promiseFactory.allAsync((this.chatCommandListeners[chat.id] || []).map(e => e.bindListener(message)));
        }
    }

};