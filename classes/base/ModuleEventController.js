'use strict';

const StandardEventController = require('./StandardEventController');
const GlobalEventController = require('./GlobalEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const Chat = require('../core/Chat');
const Message = require('../core/Message');

let globalEvents = new GlobalEventController;

class ModuleEventController extends StandardEventController {


    /**
     * @typedef {Object} Specification
     * @property {String} [name] module name (it sets automatic)
     * @property {ModuleEventController} [object] module object (it sets automatic)
     * @property {('chat'|'dm'|'group')} [type] type of chats to add this module
     * @property {Array<SpecificationCommand>} [commands] commands in module
     * @property {Specification_CommandList} [commandList]
     * @property {Specification_Vip} [vip]
     * @property {Specification_Web} [web]
     * @property {Specification_ClusterMode} [clusterMode]
     * @property {Object} [messageTemplate]
     */
    /**
     * @typedef {Object} SpecificationCommand
     * @property {String} [name] command name, and name of function in module which executes
     * @property {function(Chat, Message, SpecificationCommand): Promise<*>|*} [execute] execute function on command, its calls first if exists
     * @property {SpecificationCommandCheck} [check] rules of message text from chat to execute command
     * @property {SpecificationCommand_CommandList} [commandList]
     * @property {SpecificationCommand_CommandAccess} [commandAccess]
     * @property {SpecificationCommand_ChatSpamBan} [chatSpamBan]
     * @property {SpecificationCommand_Vip} [vip]
     * @property {SpecificationCommand_Web} [web]
     * @property {SpecificationCommand_UserNickname} [userNickname]
     * @property {SpecificationCommand_Lists} [lists]
     * @property {SpecificationCommand_AntiCaptcha} [antiCaptcha]
     * @property {Object} [messageTemplate]
     */
    /**
     * @typedef {Object|Array.<String|RegExp>|RegExp} SpecificationCommandCheck
     * @property {('chat'|'dm'|'group')} [type] type of chat (message from)
     * @property {Object|Array.<String|RegExp>|RegExp} [args] array of string or regexp for every word in message
     * @property {Number} [minArgs] min words in message
     * @property {Number} [maxArgs] max words in message
     * @property {Array<String|Number>|String|Number} [userId] user id or array of user ids message from needed
     * @property {function(Chat, Message, SpecificationCommandCheck): Boolean} [execute] check function
     * @property {Boolean} [admin] if true, command to admins
     */

    /**
     *
     */
    constructor() {
        super();
        this.chats = [];
    }

    /**
     *
     * @param {Bot} bot
     * @returns {Promise.<*>}
     * @protected
     */
    _init(bot) {
        this.bot = bot;
        return Chat.global.after(Chat.eventNames.init, (chat) => chat.addModule(this), this);
    }

    /**
     *
     * @returns {Promise.<*>}
     * @protected
     */
    _final() {
        return Chat.global.removeListenersOnByHandler(Chat.eventNames.init, this)
            .then(() => {
                let promiseEvents = [];
                this.chats.forEach((chat) => {
                    promiseEvents.push(chat.removeModule(this));
                });
                return promiseFactory.allAsync(promiseEvents);
            });
    }

    /**
     *
     * @param {Chat} chat
     * @returns {Promise.<*>}
     * @protected
     */
    _initChat(chat) {
        this.chats.push(chat);
        return chat.on(chat.eventNames.message, this.runCommandByMessage.bind(this, chat), this);
    }

    /**
     *
     * @param {Chat} chat
     * @returns {Promise.<*>}
     * @protected
     */
    _finalChat(chat) {
        if (this.chats.includes(chat))
            this.chats.splice(this.chats.indexOf(chat), 1);
        return chat.removeListenersOnByHandler(chat.eventNames.message, this);
    }

    /**
     *
     * @param {Bot} bot
     * @returns {Promise.<*>}
     */
    init(bot) {
        return this.ctrlEmit((bot) => this._init(bot), this.eventNames.init, bot)
    }

    /**
     *
     * @returns {Promise.<*>}
     */
    final() {
        return this.ctrlEmit(() => this._final(), this.eventNames.final);
    }

    /**
     *
     * @return {Promise.<*>}
     */
    stop() {
        return Promise.resolve();
    }

    /**
     *
     * @param {Chat} chat
     * @returns {Promise.<*>}
     */
    initChat(chat) {
        if (this.chats.includes(chat) || (this.specification.type && chat.type !== this.specification.type))
            return chat.removeModule(this);
        return this.ctrlEmit((chat) => this._initChat(chat), this.eventNames.initChat, chat);
    }

    /**
     *
     * @param {Chat} chat
     * @returns {Promise.<*>}
     */
    finalChat(chat) {
        return this.ctrlEmit((chat) => this._finalChat(chat), this.eventNames.finalChat, chat);
    }

    /**
     *
     * @returns {{create: string, emit: string, noNameEvent: string, newListenerPre: string, newListenerOn: string, newListenerAfter: string, newMiddlewarePre: string, newMiddlewareOn: string, removeListenerPre: string, removeListenerOn: string, removeListenerAfter: string, removeMiddlewarePre: string, removeMiddlewareOn: string, init: string, final: string, initChat: string, finalChat : string,runCommandByMessage: string, runCommand: string}}
     */
    get eventNames() {
        let eventNames = super.eventNames;
        eventNames.init = 'init';
        eventNames.final = 'final';
        eventNames.initChat = 'initChat';
        eventNames.finalChat = 'finalChat';
        eventNames.runCommandByMessage = 'runCommandByMessage';
        eventNames.runCommand = 'runCommand';
        return eventNames;
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @returns {Promise.<boolean>}
     */
    runCommandByMessage(chat, message) {
        return this.ctrlEmit((chat, message) => {
            if (!Array.isArray(this.specification.commands)
                || (chat.type === 'chat' && !this.bot.isBotName(message.getArgs()[0]))) {
                return null;
            }
            let promiseEvents = [];
            for (let command of this.specification.commands) {
                if (this.validateCommand(chat, message, command.check)
                    && (this[command.name] instanceof Function
                        || command.execute instanceof Function)) {
                    let runCommand = Object.assign({}, command);
                    Object.keys(command).map(key => {
                        if (command[key].constructor === Object)
                            runCommand[key] = Object.assign({}, command[key]);
                    });
                    promiseEvents.push(this.runCommand(chat, message, runCommand));
                }
            }
            if (!promiseEvents.length) return null;
            return promiseFactory.allAsync(promiseEvents);
        }, this.eventNames.runCommandByMessage, chat, message);
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     * @returns {Promise.<boolean>}
     */
    runCommand(chat, message, command = {}) {
        return this.ctrlEmit((chat, message, command) => {
            if (command.execute instanceof Function) {
                return command.execute(chat, message, command);
            } else if (this[command.name] instanceof Function) {
                return this[command.name](chat, message, command);
            }
            return false;
        }, this.eventNames.runCommand, chat, message, command);
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommandCheck} check
     * @param {Boolean} textCheck
     * @returns {boolean}
     */
    validateCommand(chat, message, check, textCheck = true) {
        let args = message.getCommandArgs();
        if (!check) return !textCheck;
        let result = true;
        if (typeof check === 'string') check = new RegExp(`^${check}$`, 'i');
        if (textCheck && Array.isArray(check)) {
            for (let i of check.keys()) {
                let arg = args[i];
                if (arg === undefined) arg = '';
                if (check[i] instanceof RegExp) {
                    result &= check[i].test(arg);
                } else if (check[i] instanceof Function) {
                    result &= check[i](args);
                } else if (typeof check[i] === 'string') {
                    result &= new RegExp(`^${check[i]}$`, 'i').test(arg);
                }
            }
        } else if (textCheck && check instanceof RegExp) {
            result &= check.test(args.join(' '));
        } else if (check instanceof Object) {
            if (check.type) result &= check.type === message.from;
            if (check.minArgs) result &= args.length >= check.minArgs;
            if (check.maxArgs) result &= args.length <= check.maxArgs;
            if (Array.isArray(check.userId)) {
                result &= check.userId.includes(message.user);
            } else if (check.userId) {
                result &= +message.user === +check.userId;
            }
            if (check.execute instanceof Function) result &= check.execute(chat, message, check);
            if (check.admin) result &= this.bot.admins.includes(message.user);
            if (textCheck && check.args) result &= this.validateCommand(chat, message, check.args);
        }
        return result;
    }

    /**
     *
     * @returns {Specification}
     */
    moduleSpecification() {
        return {};
    }

    /**
     *
     * @return {Specification}
     */
    get specification() {
        if (!this._specification) {
            this._specification = Object.assign({
                object: this,
                name: this.constructor.name,
                commands: [],
            }, this.moduleSpecification());
        }
        return this._specification;
    }

    /**
     *
     * @param {Specification} value
     */
    set specification(value) {
        this._specification = Object.assign({
            object: this,
            name: this.constructor.name,
            commands: [],
        }, value);
    }

    /**
     *
     * @returns {GlobalEventController}
     */
    static get global() {
        return globalEvents;
    }

}



module.exports = ModuleEventController;
