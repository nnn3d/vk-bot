'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');

module.exports = class CommandList extends ModuleEventController {

    /**
     * @typedef {Object} Specification_CommandList
     * @property {String} name name of module for users
     * @property {String} [description] description of module for users
     * @property {String} [icon] icon of module
     * @property {function(Specification, Chat): Specification|Promise<Specification>} [middleware] change the module
     *     info
     */

    /**
     * @typedef {Object} SpecificationCommand_CommandList
     * @property {String} name name of module for users
     * @property {String} [description] description of module for users
     * @property {String} [usage] how run this command
     * @property {Boolean} [hidden] if true, dont show command
     * @property {String} [icon] icon of command
     *
     */

    /**
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            commandList: {
                name: 'Команды',
                description: 'показывает модели и команды бота',
            },
            web: {
                icon: {
                    name: 'FaQuestion',
                    options: {
                        color: 'lightblue',
                    }
                },
            },
            commands: [
                {
                    name: 'commands',
                    check: /^(?:помощь|команды)(?: ([a-zа-яё \-]*))?$/i,
                    commandList: {
                        name: 'команды',
                        description: 'показывает команды бота, если указано название раздела - то только для него',
                        usage: 'команды {часть или полное название раздела}',
                    },
                    web: {
                        type: 'info',
                        filter: (props, chat, message) => {
                            return this._getModulesSpecification(chat, message).then(specs => {
                                return {
                                    full: {
                                        type: 'checkbox',
                                        data: {
                                            label: 'подробно',
                                            value: true,
                                        },
                                        options: {
                                            disabled: props && props.module && true || false,
                                        },
                                    },
                                    module: {
                                        type: 'select',
                                        data: specs.map(spec => ({
                                            label: spec.commandList.name,
                                            value: spec.commandList.name.replace(/\([^)]*\)/g, ''),
                                        })),
                                        options: {
                                            placeholder: 'раздел',
                                        },
                                    }
                                }
                            })
                        },
                        output: (props, chat, message, command) => {
                            return `команды ${props.module || props.full.length && 'подробно' || ''}`
                        },
                    }
                },
                {
                    name: 'commands',
                    check: /^  $/i,
                    commandList: {
                        name: 'команды подробно',
                        description: 'показывает команды бота c полным описанием',
                    },
                },
                {
                    name: 'modules',
                    check: /^разделы$/i,
                    commandList: {
                        name: 'разделы',
                        description: 'показывает разделы команд бота',
                    }
                },
                {
                    name: 'userInfo',
                    check: {
                        args: /^участник ?([a-zа-яё]+? ?[a-zа-яё]*?|\d{4,})?$/i,
                        type: 'chat',
                    },
                    commandList: {
                        name: 'информация об участнике',
                        usage: 'участник {имя}',
                        description: 'показывает всю доступную информацию об участнике чата',
                    },
                    vip: {
                        usages: 20,
                    },
                    web: {
                        filter: (props, chat, message) => {
                            return {
                                user: {
                                    type: 'select',
                                    options: {
                                        placeholder: 'участники',
                                    },
                                    data: chat.users.map(id => ({
                                        label: chat.userNames[id].fullName,
                                        value: id,
                                        default: id === message.user,
                                    })),
                                },
                            }
                        },
                        output: props => `участник ${props.user}`,
                    }
                }
            ]
        }
    }

    /**
     *
     * @param {Bot} bot
     * @return {Promise.<*>}
     * @private
     */
    _init(bot) {
        this.invitedChats = [];
        return super._init(bot);
    }

    _initChat(chat) {
        return super._initChat(chat).then(() => {
            return chat.on(chat.eventNames['chat.invite'], this._onInvite, this);
        })
    }

    _finalChat(chat) {
        return super._finalChat(chat).then(() => {
            return chat.removeListenersOnByHandler(chat.eventNames['chat.invite'], this);
        });
    }

    _onInvite(info) {
        if (info.invite !== this.bot.selfId || this.invitedChats.includes(info.peer)
            || this.bot.clusterMode && this.bot.clusterMode.isClusterChat(info.peer)) return;
        this.invitedChats.push(info.peer);
        return new this.bot.Message({peer: info.peer})
            .setTitle('Привет, я бот Мия! Напиши "мия команды", чтобы увидеть, что я могу! Больше информации обо мне тут - https://vk.com/page-155455368_53607863')
            .send({
                chatSpamBan: { link: true },
                antiCaptcha: { selfDirect: true }
            });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @return {Promise.<Array>}
     * @private
     */
    _getModulesSpecification(chat, message) {
        let result = Promise.resolve();
        let specifications = [];
        for (let module of chat.modules) {
            if (module.specification.type && module.specification.type !== chat.type) continue;
            let specification = Object.assign({}, module.specification, {
                commandList: Object.assign({}, module.specification.commandList),
                commands: [],
            });
            for (let command of module.specification.commands) {
                if (!this.validateCommand(chat, message, command.check, false) || !command.commandList) continue;
                let newCommand = Object.assign({}, command);
                newCommand.commandList = Object.assign({}, command.commandList);
                specification.commands.push(newCommand);
            }
            for (let module of chat.modules) {
                if (module.specification.commandList
                    && module.specification.commandList.middleware instanceof Function) {
                    result = result
                        .then(() => module.specification.commandList.middleware.call(module, specification, chat))
                }
            }
            if (specification.commands.length)
                specifications.push(specification);
        }
        return result.then(() => specifications);
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    commands(chat, message, command) {
        let info = command.check.exec(message.getCommandText());
        let full = false;
        if (/подробно/i.test(info[1])) full = true;
        let moduleName = full ? '' : info[1];
        let botName = chat.type === 'chat' ? `${this.bot.getBotName()} ` : '';
        let text = `чтобы выполнить команду, напиши обращение "${this.bot.getBotName()}" и через пробел команду, например "${this.bot.getBotName()} команды"
(в личных сообщениях обращение не обязательно)
параметры в (обычных) скобках - обязательные, в {фигурных} скобках - нет (то что в *звездочках* писать не надо)
чтобы увидеть подробное описание команд, напиши "команды подробно"
группа бота - vk.com/torchmet
подробнее обо всех командах и возможностях бота - vk.com/page-155455368_53607865\n`;
        let moduleText = '';
        let counter = 0;
        return this._getModulesSpecification(chat, message).then(specifications => {
            for (let specification of specifications) {
                let commandText = '';
                let fullCommandText = '';
                for (let commandInfo of specification.commands) {
                    if (!commandInfo.commandList || commandInfo.commandList.hidden === true) continue;
                    if (commandInfo.commandList.hidden instanceof Function
                        && commandInfo.commandList.hidden(chat, message, commandInfo)) continue;
                    let usageText = commandInfo.commandList.usage || commandInfo.commandList.name;
                    if (!usageText) continue;
                        // usageText = usageText.replace(/]/g,`]][id${this.bot.selfId}|`);
                        let upText = `${commandInfo.commandList.icon || '•'} ${usageText}\n`;
                        commandText += upText;
                        fullCommandText += upText;
                    if (commandInfo.commandList.description)
                        fullCommandText += `${commandInfo.commandList.description}\n`;
                }
                if (commandText) {
                    counter++;
                    let tmpText = `\n${specification.commandList && specification.commandList.icon || '▼'} раздел `;
                    if (specification.commandList && specification.commandList.name)
                        tmpText += `${specification.commandList.name}:\n`;
                    else tmpText += `${specification.name}:\n`;
                    let fullTmpText = tmpText;
                    if (specification.commandList && specification.commandList.description)
                        fullTmpText += `${specification.commandList.description}\n`;
                    if (moduleName && (specification.commandList && specification.commandList.name
                        && new RegExp(`^${moduleName}`, 'i').test(specification.commandList.name)
                            || specification.name && new RegExp(`^${moduleName}`, 'i').test(specification.name))) {
                        moduleText = fullTmpText + fullCommandText;
                    } else {
                        text += full ? fullTmpText + fullCommandText : tmpText + commandText;
                    }
                }
            }
        }).then(() => (counter > 1 && message.setBody(moduleText || text).send({
            chatSpamBan: { link: true },
        })));
    }

     /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     * @param {String} text
     */
    modules(chat, message, command, text = '') {
        text += `разделы бота: \n`;
        let counter = 0;
        return this._getModulesSpecification(chat, message).then(specifications => {
            for (let specification of specifications) {
                if (!specification.commandList) continue;
                let tmpText = '';
                if (specification.commandList && specification.commandList.name)
                    tmpText += `${specification.commandList.name.toUpperCase()}:\n`;
                if (specification.commandList && specification.commandList.description)
                    tmpText += `${specification.commandList.description}\n`;
                if (tmpText) text += `➤ раздел ${tmpText}`;
                counter++;
            }
        }).then(() => (counter > 1 && message.setBody(text).send()));
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    userInfo(chat, message, command) {
        let info = [];
        let userId = chat.findUser(command.check.args.exec(message.getCommandText())[1]);
        if (!userId) userId = message.user;
        return this.bot.ctrlEmit((chat, userId, info) => {
            info = [].concat(info);
            if (!info.length) info = ['ничего не найдено :('];
            return message.setTitle(`информация об участнике ${chat.userNames[userId].fullName}:`)
                .setBody(info.join('\n'))
                .send();
        }, 'CommandList.getUserInfo', chat, userId, info)
    }

};
