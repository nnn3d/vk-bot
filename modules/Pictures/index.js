'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const Message = require('../../classes/core/Message');
const promiseFactory = require('../../helpers/promiseFactory');

module.exports = class Pictures extends ModuleEventController {

    get picPublics() {
        return {
            'папуг': [137908493, 60465354, 146180669, 142203134],
            // 'сиськи': [35807284, 35807284, 29694340, 15738223],
            'мем': [25089415, 72605916, 30487105],
        }
    }

    /**
     *
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            commandList: {
                name: 'Картинки',
                description: 'Присылает в чат случайные картинки определенной тематики (18+)',
            },
            web: {
                icon: {
                    name: 'MdPhoto',
                    options: {
                        color: '#ff9710',
                    }
                },
            },
            commands: [
                {
                    name: 'pics',
                    check: '(' + Object.getOwnPropertyNames(this.picPublics).join('|') + ')',
                    commandList: {
                        description: `выдаст картинку, на которой ${Object.getOwnPropertyNames(this.picPublics).join(' или ')}, например: 'мия ${Object.getOwnPropertyNames(this.picPublics)[0]}'`,
                        usage: `('${Object.getOwnPropertyNames(this.picPublics).join(`' или '`)}')`,
                        name: 'картинка',
                    },
                    vip: {
                        usages: {
                            dm: 2,
                            chat: 5,
                        },
                    },
                    commandAccess: {
                        defaultStatus: 0,
                    },
                    messageTemplate: {
                        body: `Не удалось найти картинку для [id#{0}|#{1} #{2}]`,
                    },
                    web: {
                        filter: {
                            photo: {
                                type: 'select',
                                data: Object.keys(this.picPublics).map(pic => ({
                                    label: pic,
                                    value: pic,
                                    default: true,
                                })),
                            },
                        },
                        output: props => props.photo,
                    }
                }
            ]
        }
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {Object} command
     */
    pics(chat, message, command) {
        let info = message.getCommandArgs()[0].toLowerCase();
        let groups = this.picPublics[info];
        let groupId = `-${groups[Math.floor(Math.random() * groups.length)]}`
        this.bot.vk.api.wall.get({
            owner_id: groupId,
            count: 1
        }).then((somepost) => {
            if (!somepost) {
                return message.setBodyTemplate(
                    command.messageTemplate.body,
                    message.user,
                    chat.userNames[message.user].name,
                    chat.userNames[message.user].secondName
                )
                    .send();
            }
            let count = 30;
            let randomoffset = Math.floor(Math.random() * (somepost.count - count));
            this.bot.vk.api.wall.get({
                owner_id: groupId,
                count,
                offset: randomoffset,
            }).then((post) => {
                if (!post) {
                    return message.setBodyTemplate(
                        command.messageTemplate.body,
                        message.user,
                        chat.userNames[message.user].name,
                        chat.userNames[message.user].secondName
                    )
                        .send();
                }
                let f = 0;
                let i = 0;
                while ((f == 0) && (i < count)) {
                    if (post.items[0] && post.items[0].attachments && post.items[0].attachments[0].photo) {
                        f = 1;
                    } else {
                        i++;
                    }
                }
                if (f == 1) {
                    return message.sendPhoto({
                        value: post.items[0].attachments[0].photo.photo_604,
                        options: {
                            contentType: 'image/jpg'
                        }
                    })
                } else {
                    return message.setBodyTemplate(
                        command.messageTemplate.body,
                        message.user,
                        chat.userNames[message.user].name,
                        chat.userNames[message.user].secondName
                    )
                        .send();
                }
            })
        })
    }
};