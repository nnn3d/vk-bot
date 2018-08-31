'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const ChatNameAndPhotoModel = require('./ChatNameAndPhoto');
const VkUpload = require('../../vk/upload');

module.exports = class ChatNameAndPhoto extends ModuleEventController {

    constructor() {
        super();
        this.newsChannel = 'закрепы';
        this.streamsPhoto = {};
        this.streamsName = {};
        this.streamsMessage = {};
    }

    /**
     *
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            type: 'chat',
            vip: {
                paid: true,
            },
            commandList: {
                name: 'Название и Картинка',
                description: 'Позволяет закреплять название и фото чата, после чего их нельзя изменить'
            },
            web: {
                icon: {
                    name: 'FaLock',
                    options: {
                        color: '#3f3b3c',
                    }
                },
            },
            commands: [
                {
                    name: 'chatCall',
                    check: /^название чата(?: (.+))?/i,
                    commandList: {
                        name: 'заблокировать название чата',
                        usage: 'название чата {любое название чата}'
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `название #{0} заблокировано, не пытайтесь менять`,
                    },
                    web: {
                        type: 'action',
                        submitText: 'закрепить название',
                        change: {
                            module: this.constructor.name,
                            command: [
                                'unsetCall',
                                'showchatcall',
                            ],
                        },
                        filter: (props, chat, message, self) => {
                            return ChatNameAndPhotoModel.findOne({chatId: chat.id}).exec()
                                .then(doc => {
                                    let name = props && props.name || doc && doc.chatName || '';
                                    return {
                                        name: {
                                            type: 'text',
                                            data: {
                                                value: name,
                                                select: true,
                                            },
                                            options: {
                                                placeholder: 'название чата',
                                            },
                                        }
                                    }
                                });
                        },
                        output: props => `название чата ${props.name}`,
                    }
                },
                {
                    name: 'showchatcall',
                    check: /^  $/,
                    commandList: {
                        name: 'показать заблокированное название (веб)',
                        hidden: true,
                    },
                    web: {
                        title: 'заблокированное название чата',
                        hidden: (props, chat) => ChatNameAndPhotoModel.findOne({chatId: chat.id}).exec()
                            .then(doc => !doc || !doc.chatName),
                        output: (props, chat) => ChatNameAndPhotoModel.findOne({chatId: chat.id}).exec()
                            .then(doc => doc ? doc.chatName : ''),
                    }
                },
                {
                    name: 'chatPhoto',
                    check: /^фото чата/i,
                    commandList: {
                        name: 'заблокировать фото чата',
                        usage: 'фото чата',
                        description: '"фото чата" - заблокирует текущую картинку, "фото чата" + картинка в пересланном - заблокирует персланную картинку'
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `картинка чата заблокирована, не пытайтесь менять`,
                    },
                    web: {
                        type: 'action',
                        submitText: 'закрепить фото',
                        hidden: (props, chat) => ChatNameAndPhotoModel.findOne({chatId: chat.id}).exec()
                            .then(doc => !!doc && !!doc.chatPhoto),
                        change: {
                            module: this.constructor.name,
                            command: [
                                'chatPhoto',
                                'unsetPhoto',
                                'showchatphoto',
                            ],
                        },
                    }
                },
                {
                    name: 'chatPin',
                    check: /^закрепи?( |$)/i,
                    commandList: {
                        name: 'закрепить сообщение',
                        usage: 'закреп',
                        description: 'закрепляет сообщение, чтобы никто не мог его изменить',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'сообщение закреплено, не пытайтесь менять',
                        failFwd: 'перешлите вместе с командой сообщение, которое нужно закрепить',
                        fail: 'не удалось закрепить сообщение, возмножно, оно не из этого чата или в сообщении нет текста',
                    }
                },
                {
                    name: 'unsetChatPin',
                    check: /^разблокир(уй|овать) закреп/i,
                    commandList: {
                        name: 'разблокировать название',
                        usage: 'разблокируй закреп',
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'закрепленное сообщение беседы разблокировано, ставьте любое',
                    }
                },
                {
                    name: 'unsetCall',
                    check: /^разблокир(уй|овать) название/i,
                    commandList: {
                        name: 'разблокировать название',
                        usage: 'разблокируй название'
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `название беседы разблокировано, ставьте любое`,
                    },
                    web: {
                        type: 'action',
                        submitText: 'разблокировать название',
                        hidden: (props, chat) => ChatNameAndPhotoModel.findOne({chatId: chat.id}).exec()
                            .then(doc => !doc || !doc.chatName),
                        change: {
                            module: this.constructor.name,
                            command: [
                                'setcall',
                                'unsetCall',
                                'showchatcall',
                            ],
                        },
                    }
                },
                {
                    name: 'unsetPhoto',
                    check: /^разблокир(уй|овать) фото/i,
                    commandList: {
                        name: 'разблокировать фото',
                        usage: 'разблокируй фото'
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: `фотография беседы разблокирована, ставьте любую`,
                    },
                    web: {
                        type: 'action',
                        submitText: 'разблокировать фото',
                        hidden: (props, chat) => ChatNameAndPhotoModel.findOne({chatId: chat.id}).exec()
                            .then(doc => !doc || !doc.chatPhoto),
                        change: {
                            module: this.constructor.name,
                            command: [
                                'chatPhoto',
                                'unsetPhoto',
                                'showchatphoto',
                            ],
                        },
                    }
                },
            ]
        }
    }

    _init(bot) {
        return super._init(bot).then(() => {
            this.vkUpload = new VkUpload(this.bot.vk);
        });
    }

    /**
     *
     * @param {Chat} chat
     * @returns {Promise.<*>}
     * @private
     */
    _initChat(chat) {
        return super._initChat(chat).then(() => promiseFactory.allAsync([
            chat.on(chat.eventNames['chat.rename'], (info) => this.rename(chat, info), this),
            chat.on(chat.eventNames['chat.photo.update'], (info) => this.photoChange(chat, info), this),
            chat.on(chat.eventNames['chat.photo.remove'], (info) => this.photoChange(chat, info), this),
            chat.on(chat.eventNames['chat.pin'], (info) => this.pinChange(chat, info), this),
            chat.on(chat.eventNames['chat.unpin'], (info) => this.pinChange(chat, info), this),
        ]));
    }

    _finalChat(chat) {
        return super._finalChat(chat).then(() => promiseFactory.allAsync([
            chat.removeListenersOnByHandler(chat.eventNames['chat.rename'], this),
            chat.removeListenersOnByHandler(chat.eventNames['chat.photo.update'], this),
            chat.removeListenersOnByHandler(chat.eventNames['chat.photo.remove'], this),
            chat.removeListenersOnByHandler(chat.eventNames['chat.pin'], this),
            chat.removeListenersOnByHandler(chat.eventNames['chat.unpin'], this),
        ]));
    }

    _uploadChatPhoto(chatId, source) {
        if (chatId > 2e9) chatId -= 2e9;
        return this.bot.vk.api.photos.getChatUploadServer({ chat_id: chatId })
            .then(server => {
                return this.vkUpload._upload(server, { source }, 'file');
            })
    }

    rename(chat, info) {
        if (info.user === this.bot.selfId || this.streamsName[chat.id]) {
            return false;
        }
        this.streamsName[chat.id] = true;
        return ChatNameAndPhotoModel.findOne({chatId: chat.id})
            .then((doc) => {
                if ((!doc)) {
                    return false;
                } else if (!doc.chatName){
                    return false;
                } else {
                    return this.bot.vk.api.messages.editChat({chat_id: chat.id - 2e9, title: doc.chatName})
                }
            })
            .then(res => {
                this.streamsName[chat.id] = false;
                return res;
            })
            .catch(err => {
                this.streamsName[chat.id] = false;
                throw err;
            });
    }

    photoChange(chat, info) {
        if (info.user === this.bot.selfId || this.streamsPhoto[chat.id]) {
            return false;
        }
        this.streamsPhoto[chat.id] = true;
        return ChatNameAndPhotoModel.findOne({chatId: chat.id})
            .then((doc) => {
                if ((!doc)) {
                    return false;
                } else if (!doc.chatPhoto){
                    return false;
                } else if (!doc.fileType) {
                    return this.bot.vk.upload.chat({
                        chat_id: chat.id-2e9,
                        source: doc.chatPhoto,
                    })
                } else return this.bot.vk.api.messages.setChatPhoto({
                    file: doc.chatPhoto,
                })
            })
            .then(res => {
                this.streamsPhoto[chat.id] = false;
                return res;
            })
            .catch(err => {
                this.streamsPhoto[chat.id] = false;
                throw err;
            });
    }

    pinChange(chat, event) {
        if (event.user === this.bot.selfId || this.streamsMessage[chat.id]) return;
        this.streamsMessage[chat.id] = true;
        return ChatNameAndPhotoModel.findOne({chatId: chat.id})
            .then((doc) => {
                if (!doc || !doc.chatPin) {
                    return false;
                } else {
                    return this.bot.vk.api.call('messages.pin', {
                        peer_id: chat.id,
                        message_id: doc.chatPin,
                    })
                }
            })
            .then(res => {
                this.streamsMessage[chat.id] = false;
                return res;
            })
            .catch(err => {
                this.streamsMessage[chat.id] = false;
                throw err;
            });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    chatPhoto(chat, message, command) {
        let result = Promise.resolve();
        let isFromChat = false;
        if (message._fwd || message.hasAttachment('photo')) {
            result = this.bot.vk.api.messages.getById({
                message_ids: message.id
            }).then(doc => {
                if (
                    doc.items[0].fwd_messages
                    && doc.items[0].fwd_messages[0].attachments
                    && doc.items[0].fwd_messages[0].attachments[0].photo
                    && doc.items[0].fwd_messages[0].attachments[0].photo.photo_604
                ) {
                    return doc.items[0].fwd_messages[0].attachments[0].photo.photo_604;
                } else if (
                    doc.items[0].attachments
                    && doc.items[0].attachments[0].photo
                    && doc.items[0].attachments[0].photo.photo_604
                ) {
                    return doc.items[0].attachments[0].photo.photo_604;
                }
            }).catch(() => null);
        }
        result = result.then(url => {
            if (!url) {
                isFromChat = true;
                return this.bot.vk.api.messages.getChat({
                    chat_id: chat.id - 2e9
                }).then((doc) => {
                    if (doc.photo_200) {
                        return doc.photo_200;
                    }
                });
            }
            return url;
        });
        return result.then(url => {
            if (!url) return;
            return this._uploadChatPhoto(chat.id, url)
                .then(file => {
                    return ChatNameAndPhotoModel.findOneAndUpdate({
                        chatId: chat.id,
                    }, {
                        chatPhoto: file,
                        fileType: true,
                    }, {
                        upsert: true,
                    }).exec().then(() => {
                        if (!isFromChat) return this.bot.vk.api.messages.setChatPhoto({ file });
                    }).then(() => {
                        chat.emit('News.add', this.newsChannel, `пользователь [id${message.user}|${chat.userNames[message.user].fullName}] закрепил фото чата`);
                        return message.setTitleTemplate(command.messageTemplate.title).send();
                    })
                })
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    chatPin(chat, message, command) {
        if (!message.hasFwd()) return message.setTitle(command.messageTemplate.failFwd).send();
        return message.loadFwd().then(fwd => {
            let text = fwd[0].body;
            let userId = fwd[0].user_id;
            if (!text) return message.setTitle(command.messageTemplate.fail).send();
            return this.bot.vk.api.messages.search({
                q: text.slice(0, 500),
                peer_id: chat.id,
                count: 100,
            }).then(({ items }) => {
                items = items
                    .filter(item => item.user_id === userId && item.body === text);
                if (!items.length) return message.setTitle(command.messageTemplate.fail).send();
                let id = items[0].id;
                return ChatNameAndPhotoModel.findOneAndUpdate({
                    chatId: chat.id,
                }, {
                    chatPin: id,
                }, {
                    upsert: true,
                }).exec()
                    .then(() => (
                        this.bot.vk.api.call('messages.pin', {
                            peer_id: chat.id,
                            message_id: id,
                        })
                    ))
                    .then(() => {
                        if (text.length > 40) text = text.slice(0, 40) + '...';
                        chat.emit('News.add', this.newsChannel, `пользователь [id${message.user}|${chat.userNames[message.user].fullName}] закрепил сообщение "${text}"`);
                        return message.setTitleTemplate(command.messageTemplate.title).send()
                    }, error => (
                        message.setTitle(command.messageTemplate.fail).send()
                    ))
            })
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    unsetChatPin(chat, message, command) {
        return ChatNameAndPhotoModel.findOneAndUpdate({
            chatId: chat.id,
        }, {
            chatPin: 0,
        }).exec()
            .then(() => {
                chat.emit('News.add', this.newsChannel, `пользователь [id${message.user}|${chat.userNames[message.user].fullName}] открепил сообщение`);
                message.setTitle(command.messageTemplate.title).send()
            });
    }


    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    unsetCall(chat, message, command){
        return ChatNameAndPhotoModel.findOne({chatId: chat.id})
            .then((doc) => {
                if ((!doc)) {
                    return false;
                } else if (!doc.chatName){
                    return false;
            } else {
                doc.chatName="";
                doc.save();
                chat.emit('News.add', this.newsChannel, `пользоваетль [id${message.user}|${chat.userNames[message.user].fullName}] открепил название чата`);
                return message.setTitleTemplate(command.messageTemplate.title).send();
            }
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    unsetPhoto(chat, message, command){
        return ChatNameAndPhotoModel.findOne({chatId: chat.id})
            .then((doc) => {
                if ((!doc)) {
                    return false;
                } else if (!doc.chatPhoto){
                    return false;
                } else {
                    doc.chatPhoto="";
                    doc.save();
                    chat.emit('News.add', this.newsChannel, `пользователь [id${message.user}|${chat.userNames[message.user].fullName}] открепил фото чата`);
                    return message.setTitleTemplate(command.messageTemplate.title).send();
                }
            });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    chatCall(chat, message, command) {
        let info = command.check.exec(message.getCommandText());
        let call = info[1] || chat.title;
        return ChatNameAndPhotoModel.findOneAndUpdate({
            chatId: chat.id,
        }, {
            chatName: call,
        }, {
            upsert: true,
        }).exec()
            .then(() => {
                if (call !== chat.title) {
                    return this.bot.vk.api.messages.editChat({chat_id: chat.id - 2e9, title: call});
                }
            })
            .then(() => {
                chat.emit('News.add', this.newsChannel, `пользователь [id${message.user}|${chat.userNames[message.user].fullName}] закрепил название чата "${call}"`);
                return message.setTitleTemplate(command.messageTemplate.title, call).send();
            });
    }
};
