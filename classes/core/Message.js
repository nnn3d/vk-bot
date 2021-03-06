'use strict';

const StandardEventController = require('../base/StandardEventController');
const BaseEventController = require('../base/BaseEventController');
const VkMessage = require('../../vk/longpoll/messages').Message;
const promiseFactory = require('../../helpers/promiseFactory');

let defaultBot;

class Message extends StandardEventController {

    /**
     *
     * @param {Bot} [bot]
     * @param {Object|{id, date, peer, from, user, chat, text, admin, flags, hasEmoji, attachments}} [options]
     */
    constructor(bot, options = {}) {
        super();
        if (!(bot instanceof BaseEventController)) {
            if (defaultBot) {
                this.vk = defaultBot.vk;
                this.bot = defaultBot;
            } else {
                throw new Error('no bot in new message constructor');
            }
            options = bot;
        } else {
            this.vk = bot.vk;
            this.bot = bot;
        }
        this.text = '';
        this.resultId = [];
        this.date = Date.now();
        this._templateLength = Infinity;
        this.forward_messages = [];
        if (typeof options === 'number') options = {peer: options};
        for (let i of Object.keys(options || {})) {
            if (options[i]) this[i] = options[i];
        }
        this.initialText = this.text;
    }

    /**
     *
     * @param {Bot} bot
     * @param {BaseMessage|VK.Message} eventMessage
     * @returns {Message}
     */
    static createFromEventMessage(bot, eventMessage) {
        let message = new this.prototype.constructor(bot);
        message.eventMessage = eventMessage;
        ['id', 'date', 'peer', 'from', 'user', 'chat', 'text', 'admin', 'flags', 'hasEmoji', 'attachments', '_fwd']
            .forEach((param) => {
                if (eventMessage[param]) message[param] = eventMessage[param];
            });
        message.initialText = message.text;
        return message;
    }

    /**
     *
     * @param setBot
     */
    static setBot(setBot) {
        defaultBot = setBot;
        return this;
    }

    /**
     *
     * @param {Number} [id]
     * @returns {Message}
     */
    createReply(id) {
        id = id || this.id;
        this.forward_messages.push(id);
        return this;
    }

    /**
     * Изменяет статус набора текста пользователем в диалоге
     *
     * @param {Promise<void>}
     */
    setActivity () {
        return this.vk.api.messages.setActivity({
            type: 'typing',
            peer_id: this.peer
        });
    }

    /**
     * Проверяет наличие флага
     *
     * @param {string} name
     *
     * @return {boolean}
     */
    hasFlag (name) {
        return this.flags.includes(name);
    }

    /**
     * Проверяет наличие прикриплений
     *
     * @return {boolean}
     */
    hasAttachments () {
        return Object.keys(this.attachments).length > 0;
    }

    /**
     * Проверяет наличие прикрипления
     *
     * @param {string} name
     *
     * @return {boolean}
     */
    hasAttachment (name) {
        return name in this.attachments;
    }

    /**
     * Проверяет наличие пересылаемых сообщений
     *
     * @return {boolean}
     */
    hasFwd () {
        if (Array.isArray(this._fwd)) {
            return this._fwd.length !== 0;
        }
        return !!this._fwd;
    }

    /**
     * Возвращает пересылаемые сообщения
     *
     * @return {Array}
     */
    getFwd () {
        return VkMessage.prototype.getFwd.call(this);
    }

    /**
     * Загружает пересылаемые сообщения
     *
     * @return {Promise<Array>}
     */
    loadFwd () {
        if (!this.hasFwd()) return Promise.resolve([]);
        if (this.vk.type === 'group') {
            return Promise.resolve(this._fwd)
        }
        return this.vk.api.messages.getById({
            message_ids: this.id,
        })
            .then(response => response.items[0] && response.items[0].fwd_messages || [])
            .catch(error => {
                console.error('load fwd error', error);
                return [];
            });
    }

    /**
     * Сообщение из диалога
     *
     * @return {boolean}
     */
    isDM () {
        return this.from === 'dm';
    }

    /**
     * Сообщение из беседы
     *
     * @return {boolean}
     */
    isChat () {
        return this.from === 'chat';
    }

    /**
     * Сообщения из сообщества
     *
     * @return {boolean}
     */
    isGroup () {
        return this.from === 'group';
    }



    /**
     *
     * @param {String} string
     * @param {String|Array|Function} values
     * @param {Number} length
     * @returns {String}
     */
    _parseTemplate(string, values, length = Infinity) {
        let text = [];
        let lineNum = 0, next = true, statics = true;
        while(next && lineNum < length) {
            let valNum = 0, lineText = string;
            for (let val of values) {
                if (Array.isArray(val)) {
                    val = val[lineNum];
                    statics = false;
                } else if (val instanceof Function) {
                    val = val(lineNum);
                    statics = false;
                }
                if (val === undefined) {
                    lineText = '';
                    next = false;
                    break;
                } else if (statics && length === Infinity) {
                    next = false;
                }
                lineText = lineText.replace(`#{${valNum}}`, val);
                valNum++;
            }
            lineNum++;
            if (lineText) text.push(`${lineText}`);
        }
        return text.join('\n');
    }

    /**
     * cut text to pieces on 4000 symbols, by lines
     * @param {String} text
     * @returns {Array<String>}
     * @private
     */
    _cutText(text) {
        let result = [];
        let lines = text.split('\n');
        let message = '';
        const maxLength = 4000;
        for (let line of lines) {
            if (message.length + line.length < maxLength) {
                message += `${line}\n`;
            } else if (line.length < maxLength) {
                result.push(message);
                message = `${line}\n`;
            } else {
                if (message) result.push(message);
                message = '';
                let i = 0;
                while (line.length) {
                    result.push(line.substr(i * maxLength, ++i * maxLength));
                    line = line.substr(i * maxLength);
                }
            }
        }
        if (message)  result.push(message);
        return result;
    }

    /**
     *
     * @returns {string}
     */
    getText() {
        let text = [];
        if (this._titleTemplateString && this._titleTemplateValues) {
            text.push(this._parseTemplate(this._titleTemplateString, this._titleTemplateValues, 1));
        } else if (this._title) {
            text.push(`${this._title}`);
        }
        if (this._templateString && this._templateValues) {
            text.push(this._parseTemplate(this._templateString, this._templateValues, this._templateLength));
        } else if (this._body) {
            text.push(`${this._body}`);
        }
        if (this._endTemplateString && this._endTemplateValues) {
            text.push(this._parseTemplate(this._endTemplateString, this._endTemplateValues, 1));
        } else if (this._end) {
            text.push(`${this._end}`);
        }
        return text.join('\n');
    }

    /**
     *
     * @returns {Array}
     */
    getArgs() {
        return this.text.split(' ');
    }

    /**
     *
     * @returns {Array}
     */
    getCommandArgs() {
        let args = this.getArgs();
        return this.bot.isBotName(args[0]) ? args.slice(1) : args;
    }

    /**
     *
     * @returns {String}
     */
    getCommandText() {
        return this.getCommandArgs().join(' ');
    }

    /**
     *
     * @return {Message}
     */
    get new() {
        ['_title', '_titleTemplateString', '_titleTemplateValues', '_body', '_templateString', '_templateValues', '_templateLength',
            '_end', '_endTemplateString', '_endTemplateValues'].forEach(arg => this[arg] = undefined);
        this.forward_messages = [];
        return this;
    }

    /**
     *
     * @param {Number} length
     */
    setTemplateLength(length) {
        this._templateLength = length;
        return this;
    }

    /**
     *
     * @param {String} text
     */
    setTitle(text) {
        this._title = text;
        return this;
    }

    /**
     *
     * @param {String} string
     * @param {Number|String|Array|Function} values
     */
    setTitleTemplate(string, ...values) {
        this._titleTemplateString = string;
        this._titleTemplateValues = values;
        return this;
    }

    /**
     *
     * @param {String} text
     */
    setBody(text) {
        this._body = text;
        return this;
    }

    /**
     *
     * @param {String} string
     * @param {Number|String|Array|Function} values
     */
    setBodyTemplate(string, ...values) {
        this._templateString = string;
        this._templateValues = values;
        return this;
    }

    /**
     *
     * @param {Number} length
     */
    setBodyTemplateLength(length) {
        this._templateLength = length;
        return this;
    }

    /**
     *
     * @param {String} text
     */
    setEnd(text) {
        this._end = text;
        return this;
    }

    /**
     *
     * @param {String} string
     * @param {Number|String|Array|Function} values
     */
    setEndTemplate(string, ...values) {
        this._endTemplateString = string;
        this._endTemplateValues = values;
        return this;
    }

    _send(params = {}) {
        params.peer_id = this.peer;
        return this.ctrlEmit((params) => {
            return this.vk.api.messages.send(params)
                .then(id => this.resultId.push(id) && id);
        }, this.eventNames.send, params);
    }

    send(params = {}) {
        return this.ctrlEmit((params) => {
            params.peer_id = this.peer;
            let messages = this._cutText(this.getText());
            let promise = Promise.resolve();
            messages.forEach((msg, num) => {
                let messageParams = Object.assign({message: msg}, params);
                if (num + 1 === messages.length) {
                    ['attachment'].forEach((param) => {
                        if (this[param]) {
                            messageParams[param] = this[param];
                        }
                    });
                    // if (this.forward_messages.length) messageParams.forward_messages = this.forward_messages.join(',');
                }
                promise = promise.then(() => this._send(messageParams));
            });
            return promise;
        }, this.eventNames.sendInit, params);
    }

    edit(params = {}) {
        params.peer_id = this.peer;
        let messages = this._cutText(this.getText()).slice(0, this.resultId.length);
        let promise = Promise.resolve();
        messages.forEach((msg, num) => {
            let messageParams = Object.assign({message: msg}, params);
            if (num + 1 === messages.length) {
                ['attachment'].forEach((param) => {
                    if (this[param]) {
                        messageParams[param] = this[param];
                    }
                });
                if (this.forward_messages.length) messageParams.forward_messages = this.forward_messages.join(',');
            }
            messageParams.message_id = this.resultId[num];
            promise = promise.then(() => this.ctrlEmit((params) => {
                return this.vk.api.call('messages.edit', params);
            }, this.eventNames.edit, messageParams));
        });
        return promise;
    }

    delete(params = {}) {
        params = Object.assign({
            message_ids: this.resultId.join(','),
            delete_for_all: true,
        }, params);
        return this.ctrlEmit((params) => {
            return this.vk.api.call('messages.delete', params);
        }, this.eventNames.delete, params);
    }

    /**
     * Отправляет стикер в текущий диалог
     *
     * @param {number} id
     *
     * @return {Promise<Number>}
     */
    sendSticker (id) {
        return this._send({
            sticker_id: id
        });
    }

    /**
     * Отправляет фотографию в диалог
     *
     * @param {*}  source
     * @param {Object} params
     *
     * @return {Promise}
     */
    sendPhoto (source, params = {}) {
        return this.ctrlEmit((source, params) => {
            return this.vk.upload.message({
                source
            })
                .then((photo) => (
                    this.vk.getAttachment('photo', photo)
                ))
                .then((attachment) => (
                    this.send(Object.assign(params, { attachment }))
                ));
        }, this.eventNames.sendPhoto, source, params);
    }

    /**
     *
     * @returns {{create: string, emit: string, noNameEvent: string, newListenerPre: string, newListenerOn: string, newListenerAfter: string, newMiddlewarePre: string, newMiddlewareOn: string, removeListenerPre: string, removeListenerOn: string, removeListenerAfter: string, removeMiddlewarePre: string, removeMiddlewareOn: string, send: string, sendInit: string, sendPhoto: string}}
     */
    get eventNames() {
        let eventNames = super.eventNames;
        eventNames.send = 'send';
        eventNames.sendInit = 'sendInit';
        eventNames.sendPhoto = 'sendPhoto';
        eventNames.edit = 'edit';
        eventNames.delete = 'delete';
        return eventNames;
    }
}

module.exports = Message;
