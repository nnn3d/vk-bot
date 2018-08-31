'use strict';

const CoreModuleEventController = require('../../classes/base/CoreModuleEventController');
const ModuleEventController = require('../../classes/base/ModuleEventController');
const pf = require('../../helpers/promiseFactory');
const request = require('request').defaults({ encoding: null });
const GroupsChats = require('./GroupsChats');
const VK = require('../../vk');
const Message = require('../../classes/core/Message');

module.exports = class GroupsModule extends CoreModuleEventController {
    /**
     * @property {Boolean} [selfDirect]
     */

    constructor() {
        super();
        this.mapGroupChats = {};
    }


    _init(bot) {
        this.bot=bot;
        this.botVk=this.bot.groupAccounts[0];
        const defaultSend=this.bot.vk.api.messages.send.bind(this.bot.vk.api);
        this.bot.Chat.global.on(this.bot.Chat.eventNames.addUser, (userId, chat) => {
            if (userId < 0) {
                if (-userId === +this.botVk.group_id) {
                    this.getGroupChatId(this.botVk.group_id, chat.id)
                }
            }
        });
        this.bot.vk.api.messages.send=(params) => {
            if (params.peer_id in this.mapGroupChats) {
                const newParams = Object.assign({},params,{peer_id: this.mapGroupChats[params.peer_id]});
                return this.botVk.api.messages.send(newParams).catch(() => {
                    return defaultSend(params);
                });
            }
            return defaultSend(params);
        };
        this.botVk.longpoll.on('error', e => {
            console.error(e);
            setTimeout(() => this.botVk.longpoll.restartGroups(), 5e3);
        });
        this.botVk.longpoll.on('message', (message) => {
            if ((this.bot.admins.indexOf(message.user)!==-1) && (message.text))  {
                let result=message.text.match(new RegExp(`\\[club${this.botVk.group_id}\\|[^\\]]+\\] номер чатика (\\d{10})`));
                if (!result) return;
                let selfChatId=result[1];
                if (this.bot.clusterMode && this.bot.clusterMode.isClusterChat(selfChatId)) {
                    return
                }
                this.mapGroupChats[selfChatId] = message.peer;
                return GroupsChats.findOneAndUpdate({
                    selfId: this.bot.selfId,
                    botId: this.botVk.group_id, // ид группы
                    selfChatId: selfChatId, // ид чата для главного бота
                }, {
                    botChatId: message.peer, // ид чата для группы подмены
                }, {
                    upsert: true, // это нужно
                }).then(() => {
                    this.botVk.api.messages.send({ peer_id: message.peer, message: "Всем привет, я бот Мия! Я запомнила номер вашего чата " + selfChatId + "! Он может пригодиться вам, поэтому не теряйте. Если захотите узнать его напишите \"мия вип номер\" " })
                })
            }
        })

    }

    getGroupChatId(botId,chatId){
        return GroupsChats.findOne({
            selfId: this.bot.selfId,
            botId,
            selfChatId: chatId,
        }).then(data => {
          if (!data) {
              return new this.bot.Message({ peer: chatId })
                  .setTitle("*club158645511 (Мия Лютая) номер чатика " + chatId)
                  .send({
                      chatSpamBan: { replaced: true },
                      antiCaptcha: { selfDirect: true },
                  })
          }  else {
              return this.mapGroupChats[data.selfChatId] = data.botChatId;
          }
        })
    }
}
