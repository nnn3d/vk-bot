'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const ChatStatistics = require('./ChatStatistics');
const UserStatistics = require('../../classes/db/UserStatistics');
const UserHourStatistics = require('../../classes/db/UserHourStatistics');
const Message = require('../../classes/core/Message');
const promiseFactory = require('../../helpers/promiseFactory');

module.exports = class Statistics extends ModuleEventController {

    constructor({ ignoreChats = [] } = {}) {
        super();
        this.ignoreChats = ignoreChats;
    }

    /**
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            commandList: {
                name: 'Статистика',
                description: 'Считает всю статистику беседы - количество сообщений, символов, стикеров, прикреплений, голосовых сообщений, использованных команд - как для пользователя, так и для всего чата, и показывает эту информацию',
            },
            vip: {
                paid: false,
            },
            web: {
                icon: {
                    name: 'FaPieChart',
                    options: {
                        color: '#a0ea78',
                    }
                },
            },
            commands: [
                {
                    name: 'statByUser',
                    check: {
                        args: /^(полный )?стат(?:истика)?( чата)?(?: ((?!за)[a-zа-яё]+? ?[a-zа-яё]*?|\d{4,}))?(?: за|за)?(?: (\d{1,2})(?: (час(?:а|ов)?|дней|день|дня))?)?[^a-zа-яё]*?$/i,
                        type: 'chat',
                    },
                    vip: {
                        usages: 25,
                    },
                    messageTemplate: {
                        titleFull: `статистика #{0} за последние #{1}: 
(&#127374;&#8194;символов | &#9993;&#8194;сообщений | &#128521;&#8194;стикеров | &#128257;&#8194;пересылаемых сообщений | 📎&#8194;прикреплений | 🎤&#8194;голосовых сообщений | &#128187;&#8194;команд бота)`,
                        bodyHoursFull: `#{0}.#{1}.#{2} в #{3}: 
- &#127374; #{4} |&#8194;&#9993;&#8194;#{5} | &#128521;&#8194;#{6} | &#128257;&#8194;#{7} | 📎&#8194;#{8} | 🎤&#8194;#{9} | &#128187;&#8194;#{10} `,
                        bodyDaysFull: `#{0}.#{1}.#{2}: 
- &#127374; #{4} |&#8194;&#9993;&#8194;#{5} | &#128521;&#8194;#{6} | &#128257;&#8194;#{7} | 📎&#8194;#{8} | 🎤&#8194;#{9} | &#128187;&#8194;#{10}`,
                        bodySumFull: `сумма: 
- &#127374; #{0} |&#8194;&#9993;&#8194;#{1} | &#128521;&#8194;#{2} | &#128257;&#8194;#{3} | 📎&#8194;#{4} | 🎤&#8194;#{5} | &#128187;&#8194;#{6}`,
                        title: `статистика #{0} за последние #{1}: (символов | сообщений)`,
                        bodyHours: `#{0}.#{1}.#{2} в #{3}:&#8194; #{4} | #{5}`,
                        bodyDays: `#{0}.#{1}.#{2}:&#8194; #{4} | #{5}`,
                        bodySum: `сумма: #{0} | #{1}`,
                        titleFail: `статистики пользователя #{0} за последние #{1} не найдено`,
                        userFail: `пользователь #{0} не найден`
                    },
                    commandList: {
                        name: 'статистика',
                        description: '"[полный] стат {([имя пользователя] или [id пользователя]) или (чата)} {[цифра]} {дни или часы}" - например, "стат иван иванов за 5 дней" или "полный стат 83754733 за 24 часа", или "стат чата за 5 дней"',
                        usage: 'стат {имя пользователя} {количество дней}',
                    },
                    web: {
                        disableReload: true,
                        filter: (props, chat, message) => {
                            let intervalType = props && props.opts.includes('hours') ? 'ч.' : 'дн.';
                            let chatStat = props && props.opts.includes('chat');
                            return {
                                opts: {
                                    type: 'multi',
                                    options: {
                                        placeholder: 'параметры',
                                    },
                                    data: [
                                        {
                                            label: 'подробно',
                                            value: 'full',
                                        },
                                        {
                                            label: 'стат чата',
                                            value: 'chat',
                                        },
                                        {
                                            label: 'по часам',
                                            value: 'hours',
                                        },
                                    ]
                                },
                                user: {
                                    type: 'select',
                                    options: {
                                        placeholder: 'участники',
                                        disabled: chatStat,
                                    },
                                    data: chat.users.map(id => ({
                                        label: chat.userNames[id].fullName,
                                        value: id,
                                    })),
                                },
                                interval: {
                                    type: 'select',
                                    data: new Array(30).fill(1).map((el, num) => ({
                                        label: `за ${el+num} ${intervalType}`,
                                        value: el+num,
                                        default: num === 6,
                                    }))
                                }
                            }
                        },
                        output: props => {
                            let out = '';
                            if (props.opts.includes('full')) out += 'полный ';
                            out += `стат`;
                            if (props.opts.includes('chat')) out += ' чата';
                            else if (props.user) out += ` ${props.user}`;
                            out +=` ${props.interval}`;
                            if (props.opts.includes('hours')) out += ' час';
                            return out;
                        }
                    }
                },
                {
                    name: 'statByUserAdmin',
                    check: {
                        args: /^(полный )?((?!!)!)?(стат)(?: за|за)?(?: (\d{1,2})(?: (час(?:а|ов)?|дней|день|дня))?)?[^a-zа-яё]*?$/i,
                        type: 'dm',
                    },
                    vip: {
                        usages: 5,
                    },
                    messageTemplate: {
                        titleFull: `суммарная статистика #{0} за последние #{1} (чатов: #{2}): 
(&#127374;&#8194;символов | &#9993;&#8194;сообщений | &#128521;&#8194;стикеров | &#128257;&#8194;пересылаемых сообщений | 📎&#8194;прикреплений | 🎤&#8194;голосовых сообщений | &#128187;&#8194;команд бота)`,
                        bodyHoursFull: `#{0}.#{1}.#{2} в #{3}: 
- &#127374; #{4} |&#8194;&#9993;&#8194;#{5} | &#128521;&#8194;#{6} | &#128257;&#8194;#{7} | 📎&#8194;#{8} | 🎤&#8194;#{9} | &#128187;&#8194;#{10} `,
                        bodyDaysFull: `#{0}.#{1}.#{2}: 
- &#127374; #{4} |&#8194;&#9993;&#8194;#{5} | &#128521;&#8194;#{6} | &#128257;&#8194;#{7} | 📎&#8194;#{8} | 🎤&#8194;#{9} | &#128187;&#8194;#{10}`,
                        bodySumFull: `сумма: 
- &#127374; #{0} |&#8194;&#9993;&#8194;#{1} | &#128521;&#8194;#{2} | &#128257;&#8194;#{3} | 📎&#8194;#{4} | 🎤&#8194;#{5} | &#128187;&#8194;#{6}`,
                        title: `суммарная статистика #{0} за последние #{1} (чатов: #{2}): (символов | сообщений)`,
                        bodyHours: `#{0}.#{1}.#{2} в #{3}:&#8194; #{4} | #{5}`,
                        bodyDays: `#{0}.#{1}.#{2}:&#8194; #{4} | #{5}`,
                        bodySum: `сумма: #{0} | #{1}`,
                        titleFail: `статистики пользователя #{0} за последние #{1} не найдено`,
                        userFail: `пользователь #{0} не найден`
                    },
                    commandList: {
                        name: 'статистика пользователя',
                        description: `[полный] стат {[цифра]} {дни или часы} - показывает суммарную статистику из всех чатов с ботом, в которых вы находитесь - например, "стат за 5 дней" или "полный стат за 24 часа"`,
                        usage: 'стат {количество дней}',
                    },
                    web: {
                        filter: (props) => {
                            let byDays = props && props.intervalType === 'день';
                            let intervalType = byDays ? 'дн.' : 'ч.';
                            let maxInterval = byDays ? 7 : 24;
                            let select = props && props.interval > maxInterval;
                            return {
                                full: {
                                    type: 'checkbox',
                                    data: {
                                        label: 'полный',
                                        value: 'full',
                                    }
                                },
                                intervalType: {
                                    type: 'radio',
                                    data: [
                                        {
                                            label: 'в днях',
                                            value: 'день',
                                        }, {
                                            label: 'в часах',
                                            value: 'час',
                                            default: true,
                                        }
                                    ]
                                },
                                interval: {
                                    type: 'select',
                                    data: new Array(maxInterval).fill(1).map((el, num) => ({
                                        label: `за ${el+num} ${intervalType}`,
                                        value: el+num,
                                        default: num === 0,
                                        select: select && num === maxInterval - 1,
                                    }))
                                }
                            }
                        },
                        output: props => {
                            let out = '';
                            if (props.intervalType === 'день') props.interval = Math.max(props.interval, 7);
                            if (props.full.length) out += 'полный ';
                            out += `стат ${props.interval} ${props.intervalType}`;
                            return out;
                        }
                    }
                },
                {
                    name: 'parseStat',
                    check: {
                        args: /^изучить чат/,
                        type: 'chat',
                        admin: true,
                    },
                    vip: {
                        paid: true,
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        confirm: `если начать изучать чат, вся предыдущая статистика будет обновлена, уверен? ("да" или "нет")`,
                        sessionFail: `чат уже изучается`,
                        parseFail: `непредвиденная ошибка при изучении чата...`,
                        parseInfo: `чат изучен на #{0}%, продолжаю изучать...`,
                        start: `начинаю изучать чат (#{0} сообщений)`,
                        end: `чат полностью изучен, статистика обновлена`
                    },
                },
                {
                    name: 'top',
                    check: {
                        args: /^(полный )?топ(?: (?:(\d{1,3})(?:[^\d.\-]|$)|(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})(?:[ .\-]*(\d{1,2})[.\-](\d{1,2})[.\-](\d{4}))?))?$/i,
                        type: 'chat',
                    },
                    vip: {
                        usages: 10,
                    },
                    messageTemplate: {
                        title: `топ чата за #{0} - #{1}: (символов | сообщений):`,
                        titleFull: `топ чата за #{0} - #{1}:
(&#127374;&#8194;символов | &#9993;&#8194;сообщений | &#128521;&#8194;стикеров | &#128257;&#8194;пересылаемых сообщений | 📎&#8194;прикреплений | 🎤&#8194;голосовых сообщений | &#128187;&#8194;команд бота)`,
                        titleAllStat: `топ чата за все время (символов | сообщений):`,
                        titleAllStatFull: `топ чата за все время:
(&#127374;&#8194;символов | &#9993;&#8194;сообщений | &#128521;&#8194;стикеров | &#128257;&#8194;пересылаемых сообщений | 📎&#8194;прикреплений | 🎤&#8194;голосовых сообщений | &#128187;&#8194;команд бота)`,
                        titleDays: `топ чата за последние #{0} дней (символов | сообщений):`,
                        titleDaysFull: `топ чата за последние #{0} дней:
(&#127374;&#8194;символов | &#9993;&#8194;сообщений | &#128521;&#8194;стикеров | &#128257;&#8194;пересылаемых сообщений | 📎&#8194;прикреплений | 🎤&#8194;голосовых сообщений | &#128187;&#8194;команд бота)`,
                        body: `#{0}. #{1}: #{2} | #{3} #{9}`,
                        bodyFull: `#{0}. #{1}: 
- &#127374; #{2} |&#8194;&#9993;&#8194;#{3} | &#128521;&#8194;#{4} | &#128257;&#8194;#{5} | 📎&#8194;#{6} | 🎤&#8194;#{7} | &#128187;&#8194;#{8}  #{9}`,
                        titleFail: `топ чата за это время не найден`,
                    },
                    commandList: {
                        name: 'топ',
                        description: '[полный] топ {[количество дней] или [начальная дата]} {[конечная дата]} - например, "топ" - показывает топ за все время, или "полный топ 10.10.2010" показывает подробный топ с 10 октября 2010 г. до настоящего времени, "топ 7" показывает топ за 7 дней, "топ 10.10.10 10.1.2011" покажет топ в промежуток с 10.10.10 по 10.1.2011',
                        usage: 'топ {количество дней}',
                    },
                    web: {
                        disableReload: true,
                        filter: {
                            period: {
                                type: 'select',
                                data: new Array(30).fill(0).map((el, num) => ({
                                    label: `${num+1} дн.`,
                                    value: num+1,
                                    default: num+1 === 7,
                                })),
                            },
                            full: {
                                type: 'checkbox',
                                data: {
                                    label: 'подробно',
                                    value: 'full',
                                }
                            },
                        },
                        output: (props) => {
                            let out = '';
                            if (props.full.length) out += 'полный ';
                            out += `топ ${props.period}`;
                            return out;
                        }
                    }
                },
//                 {
//                     name: 'chatTop',
//                     check: {
//                         args: /топ чата(?: по (символам|сообщениям|стикерам|пересылкам|прикреплениям|голосовым|командам))?/i,
//                         type: 'chat',
//                     },
//                     vip: {
//                         usages: 15,
//                     },
//                     messageTemplate: {
//                         title: `топ активных дней чата по #{0}:
// (&#127374;&#8194;символов | &#9993;&#8194;сообщений | &#128521;&#8194;стикеров | &#128257;&#8194;пересылаемых сообщений | 📎&#8194;прикреплений | 🎤&#8194;голосовых сообщений | &#128187;&#8194;команд бота)`,
//                         body: `#{0}.#{1}.#{2}:
// - &#127374; #{3} |&#8194;&#9993;&#8194;#{4} | &#128521;&#8194;#{5} | &#128257;&#8194;#{6} | 📎&#8194;#{7} | 🎤&#8194;#{8} | &#128187;&#8194;#{9}`,
//                     },
//                     commandList: {
//                         name: 'топ чата',
//                         usage: 'топ чата',
//                         description: 'топ чата {по [(символам) или (сообщениям) или (стикерам) или (пересылкам) или (прикреплениям) или (голосовым) или (командам)]} - показывает топ дней активности чата по критерию (по умолчанию по символам). например, "топ чата", или "топ чата по сообщениям", или "топ чата по голосовым"'
//                     }
//                 },
                {
                    name: 'botChatsTop',
                    check: /^топ бесед?/i,
                    messageTemplate: {
                        title: `топ #{0} бесед за вчера: \n(обновляется в конце каждого дня)`,
                        titleLoad: `идет подсчет топа бесед...`,
                        body: `#{0}. #{1} (##{2}): #{3} символов`,
                        end: `.....\n#{0}. #{1} (##{2}): #{3} символов`,
                    },
                    commandList: {
                        name: 'топ бесед',
                        description: 'показывает топ бесед (по символам), в которых присутствует бот'
                    },
                    web: {
                        output: 'топ бесед',
                    }
                },
                {
                    name: 'activity',
                    check: {
                        args: /^актив(?:ность)?(?: $|$)/i,
                        type: 'chat',
                    },
                    vip: {
                        usages: 10,
                    },
                    commandList: {
                        name: 'актив',
                        description: 'Показывает кто и когда последний раз что-то писал в чате',
                    },
                    messageTemplate: {
                        title: `актив пользователей:`,
                        body: `#{0}. #{1} - #{2}`,
                        userFail: `не актив`,
                    },
                    web: {
                        output: 'актив',
                    }
                },
                {
                    name: 'communication',
                    check: {
                        args: /^связи(?: ([a-zа-яё]+? ?[a-zа-яё]*?|\d{4,}))?$/i,
                        type: 'chat',
                    },
                    commandList: {
                        name: 'связи',
                        usage: 'связи {имя пользователя}',
                        description: 'связи {[имя пользователя [ + фамилия ]] или [id пользователя]} - высчитывает, с кем больше всего общается пользователь',
                    },
                    vip: {
                        usages: 2,
                    },
                    messageTemplate: {
                        wait: `считаем связи пользователя #{0}...`,
                        title: `связи пользователя #{0}:`,
                        body: `#{0}. #{1} - #{2}%`,
                        userFail: `пользователь #{0} не найден`,
                    },
                },
                {
                    name: 'allStat',
                    check: {
                        args: /^общий стат(?: (\d+)( час[а-яё]*)?)?(?: чат (\S+))?(?: юзер (\S+))?(?: груп (\S+))?(?: сорт (\S+))?( инве?р?с?)?$/i,
                        admin: true,
                    },
                    messageTemplate: {
                        titleFull: `общая статистика#{0}: 
(&#127374;&#8194;символов | &#9993;&#8194;сообщений | &#128521;&#8194;стикеров | &#128257;&#8194;пересылаемых сообщений | 📎&#8194;прикреплений | 🎤&#8194;голосовых сообщений | &#128187;&#8194;команд бота)`,
                        bodyFull: `#{0} 
- &#127374; #{1} |&#8194;&#9993;&#8194;#{2} | &#128521;&#8194;#{3} | &#128257;&#8194;#{4} | 📎&#8194;#{5} | 🎤&#8194;#{6} | &#128187;&#8194;#{7}`,
                        emptyFail: `статистики по данному запросу не найдено`,
                    },
                    commandList: {
                        name: 'общая статистика',
                        description: `общий стат {количество дней или часов} {"час"} {"чат (номер или название)"} {"юзер (номер или имя {+ фамилия через тире})} {"груп ('чат' или 'юзер' или 'день' или 'час')"} {"сорт ('символы' или 'сообщения' или 'стикеры' или 'пересылки' или 'прикрепления' или 'голосовые' или 'команды')"} {'инверс'}`,
                        usage: 'общий стат {количество дней}',
                    },
                },
            ]
        };
    }

    _init(bot) {
        this.parseChat = [];
        this.maxMessageLength = 400;
        /**
         *
         * @type { Object<String, Object.<String,{ incOptions: {}, time: Number }>> }
         */
        this.statisticsInfo = {};
        this.saveStatisticsIndex = 0;
        this.savePromise = Promise.resolve();
        this.botChatsTopPromise = Promise.resolve();
        this.runComandPromise = Promise.resolve();
        this.runComandPromiseVip = Promise.resolve();
        this.statisticsSaveInterval = setInterval(() => {
            this.savePromise.then(() => this._saveLocalStatisticsToDB());
        }, 2e5);
        process.on('message', packet => {
            if (packet && packet.topic === 'statisticsBotChatsTop') {
                this.botChatsTopInfo = Object.assign(this.botChatsTopInfo || {}, packet.data.botChatsTopInfo);
                this.botChatsTopData = new Date(packet.data.botChatsTopData);
            }
        });
        return super._init(bot).then(() => {
            this.specification = this.moduleSpecification();
            return promiseFactory.allAsync([
                this.global.after(this.eventNames.runCommand, this._runCommandStatistics, this),
                this.bot.middlewareOn('CommandList.getUserInfo', this._getUserInfo, this),
                this.bot.middlewareOn('Lists.getAutoLists', this._getAutoLists, this),
            ])
        });
    }

    _final() {
        return super._final().then(() => promiseFactory.allAsync([
            this.global.removeListenersAfterByHandler(this.eventNames.runCommand, this),
            this.bot.removeMiddlewareOnByHandler('CommandList.getUserInfo', this),
            this.bot.removeMiddlewareOnByHandler('Lists.getAutoLists', this),
        ]))
    }

    /**
     *
     * @param {Chat} chat
     * @returns {Promise.<*>}
     * @private
     */
    _initChat(chat) {
        return super._initChat(chat).then(() => {
            if (chat.type !== 'chat') return;
            return chat.after(chat.eventNames.message, this._saveStatistics.bind(this, chat), this)
                .then(() => chat.on(chat.eventNames['chat.invite'], this._activityInit.bind(this, chat), this));
        })
    }

    /**
     *
     * @param {Chat} chat
     * @returns {Promise.<*>}
     * @private
     */
    _finalChat(chat) {
        return super._finalChat(chat).then(() => chat.removeListenersOnByHandler(chat.eventNames['chat.invite'], this))
    }

    /**
     *
     * @return {Promise.<*>}
     */
    stop() {
        return this._saveLocalStatisticsToDB(0);
    }

    /**
     *
     * @param {Chat} chat
     * @param info
     *
     */
    _activityInit (chat, info) {
        let date = new Date();
        let doc = new UserHourStatistics({
            chatId: chat.id,
            userId: info.invite,
        });
        doc.fullDate = new Date();
        doc.save().then(() => {}, () => {});
        return UserStatistics.findOne({chatId: chat.id, userId: info.invite})
            .then((doc) => {
                if (!doc) {
                    new UserStatistics({
                        chatId: chat.id,
                        userId: info.invite,
                        lastActivity: Date.now()
                    }).save();
                } else {
                    doc.lastActivity = Date.now();
                    return doc.save();
                }
            });
    }

    _findFirstActivity(chat, userId) {
        return UserHourStatistics.findOne({userId, chatId: chat.id}).sort('date.time').exec()
            .then(doc => doc && doc.fullDate);
    }

    _periodToText(time) {
        let desc = [];
        if (time >= 24 * 60 * 60 * 1000) {
            desc.push(Math.floor(time / (24 * 60 * 60 * 1000)) + ' дн.');
            time = time % (24 * 60 * 60 * 1000);
        }
        if (time >= 60 * 60 * 1000) {
            desc.push(Math.floor(time / (60 * 60 * 1000)) + ' ч.');
            time = time % (60 * 60 * 1000);
        }
        if (time >= 5 * 60 * 1000) {
            desc.push(Math.floor(time / (60 * 1000)) + ' мин.');
        }
        if (!desc.length) desc = ['актив'];
        return desc.join(' ');
    }

    _runCommandStatistics(chat, message, command) {
        if (!chat.modules.includes(this)) return;
        let time = message.date * 1000;
        let incOptions = {
            countSymbols: 0,
            countMessages: 0,
            countStickers: 0,
            countForwards: 0,
            countAttachments: 0,
            countAudio: 0,
            countCommands: 1,
        };
        return this._saveLocalStatistics(chat.id, message.user, time, incOptions);
    }

    /**
     *
     * @param {Chat} chat
     * @param {Number} userId
     * @param {Object} info
     * @private
     */
    _getUserInfo([chat, userId, info]) {
        if (!chat.modules.includes(this)) return;
        let chatId = chat.id;
        let tmpDate = num => num > 9 ? num : '0'+num;
        return this._findFirstActivity(chat, userId).then(date => {
            if (date) info.push(`в чате с: ${tmpDate(date.getDate())}.${tmpDate(date.getMonth()+1)}.${date.getFullYear()}`);
            return UserStatistics.findOne({chatId, userId}).exec().then(doc => {
                let lastActivity = doc && doc.lastActivity;
                if (this.statisticsInfo[chatId] && this.statisticsInfo[chatId][userId])
                    lastActivity = this.statisticsInfo[chat.id][userId].time;
                if (lastActivity) {
                    let activity = this._periodToText(Date.now() - doc.lastActivity);
                    info.push(`последняя активность: ${activity}`)
                }
                return UserHourStatistics.find({ chatId, userId })
                    .betweenDates(Date.now() - 7 * 24 * 36e5)
                    .sort('date.time')
                    .exec()
                    .then(docs => {
                        if (!docs.length) return;
                        let time = docs[0].date.time;
                        let sum = docs.reduce((doc1, doc2) => {
                            this._sumDocs(doc1, doc2);
                            return doc1;
                        });
                        let symbols = sum.countSymbols / Math.max(Date.now() - time, 24 * 36e5) * 24 * 36e5;
                        info.push(`средний актив за неделю (симв/день): ${Math.round(symbols)}`);
                    })
            })
        })
    }

    _getUsersActivity(chat) {
        let users = chat.users.map(id => ({id}))
        let chatInfo = this.statisticsInfo[chat.id] || {};
        return UserStatistics.find({chatId: chat.id, userId: {$in: chat.users}}).exec()
            .then(docs => {
                let addActivity = (user, lastActivity) => {
                    user.lastActivity = lastActivity;
                };
                for (let user of users) {
                    if (chatInfo[user.id]) {
                        addActivity(user, chatInfo[user.id].time);
                    } else {
                        for (let doc of docs) {
                            if (doc.userId === user.id && doc.lastActivity) {
                                addActivity(user, doc.lastActivity);
                                break;
                            }
                        }
                        if (!user.lastActivity) user.lastActivity = 0;
                    }
                }
                users.sort((a, b) => b.lastActivity - a.lastActivity);
                return users;
            })
    }

    _getAutoLists([chat, lists]) {
        if (!chat.modules.includes(this)) return;
        const getSymbolsUsers = (chat, actionName, self) => {
            let [, days, moreThen, symbols] = self.check.exec(actionName);
            let direction = moreThen ? 1 : -1;
            let timeFrom = Date.now() - days * 24 * 36e5;
            let dateFrom = new Date(timeFrom);
            dateFrom.setHours(23, 59, 59);
            let users = {};
            chat.users.map(userId => users[userId] = 0);
            return new Promise((resolve, reject) => {
                UserHourStatistics
                    .find()
                    .betweenDates(dateFrom)
                    .where({chatId: chat.id, userId: {$in: chat.users}})
                    .cursor()
                    .on('data', doc => {
                        users[doc.userId] += doc.countSymbols;
                    })
                    .on('end', () => {
                        let list = [];
                        Object.keys(users).map(id => {
                            if (direction * users[id] > direction * symbols) {
                                list.push(+id);
                            }
                        });
                        list.sort((a, b) => users[b] - users[a]);
                        resolve(list);
                    })
            })
        };
        const getNotActiveUsers = (chat, actionName, self) => {
            let [, days] = self.check.exec(actionName);
            return this._getUsersActivity(chat).then(users => {
                users = users.filter(user => {
                    if (days) return Date.now() - user.lastActivity > days * 24 * 36e5 && user.lastActivity;
                    return !user.lastActivity;
                });
                return users.map(user => user.id);
            })
        };
        const getOutUsers = (chat, actionName, self) => {
            return UserStatistics.find({ chatId: chat.id }).exec()
                .then(docs => {
                    docs.sort((a, b) => b.lastActivity - a.lastActivity);
                    let users = docs
                        .slice(0, 250)
                        .map(doc => doc.userId)
                        .filter(userId => !chat.allUsers.includes(userId) && !this.bot.admins.includes(userId));
                    return this.bot.vk.api.users.get({
                        user_ids: users.join(','),
                    }).then(vkUsers => {
                        vkUsers.map(user => {
                            let userId = user.id;
                            chat.userNames[userId].name = user.first_name;
                            chat.userNames[userId].secondName = `${user.last_name} [id${userId}|${userId}]`;
                        });
                        return users;
                    })
                })
        };
        const getChatDaysUsers = (chat, actionName, self) => {
            let [, moreThen, days] = self.check.exec(actionName);
            let needTime = Date.now() - days * 24 * 36e5;
            let direction = moreThen ? 1 : -1;
            return promiseFactory
                .allAsync(chat.users.map(
                    id => this._findFirstActivity(chat, id).then(date => ({id, time: +date || Date.now()}))
                ))
                .then(users => {
                    return users.filter(user => user.time * direction < needTime * direction).map(user => user.id)
                })
        };
        /**
         * @type {Array<SpecificationCommand_Lists_autoList>}
         */
        let autoLists = [
            {
                name: 'символов за (дни) больше (количество)',
                description: 'составляет список из участников, у которых больше символов, чем указанно, за указанное количество дней',
                check: /^символов за (\d+) (больше) (\d+)$/,
                getUsers: getSymbolsUsers,
            },
            {
                name: 'символов за (дни) меньше (количество)',
                description: 'составляет список из участников, у которых меньше символов, чем указанно, за указанное количество дней',
                check: /^символов за (\d+) меньше() (\d+)$/,
                getUsers: getSymbolsUsers,
            },
            {
                name: 'не актив {дни}',
                description: 'составляет список из участников, которые были не активны указанное количество дней, если дни не указаны - составит из тех, кто не был активен никогда с момента инвайта',
                check: /^не ?актив(?: (\d+))?$/,
                getUsers: getNotActiveUsers,
            },
            {
                name: 'вышедшие',
                description: 'составляет список из участников, которые вышли из чата или были кикнуты',
                check: /^вышедшие$/,
                getUsers: getOutUsers,
            },
            {
                name: 'в чате больше (дни)',
                description: 'составляет список из участников, которые находятся в чате больше указанных дней (с первого сообщения)',
                check: /^в чате (больше) (\d+)$/,
                getUsers: getChatDaysUsers,
            },
            {
                name: 'в чате меньше (дни)',
                description: 'составляет список из участников, которые находятся в чате меньше указанных дней (с первого сообщения)',
                check: /^в чате меньше() (\d+)$/,
                getUsers: getChatDaysUsers,
            },
        ];
        return [chat, lists.concat(autoLists)];
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {Boolean} checkName
     * @private
     */
    _saveStatistics(chat, message, checkName = false) {
        let messageLength = message.text.replace(/[^а-яёa-z]/ig, '').length;
        if (messageLength > this.maxMessageLength) return;
        let time = message.date * 1000;
        let sticker = (message.attachments && message.attachments.sticker) ? 1 : 0;
        let forwards = message.hasFwd() ? 1 : 0;
        let audio = (message.attachments
            && Array.isArray(message.attachments.doc)
            && message.attachments.doc[0].type === 'audiomsg') ? 1 : 0;
        let attachments = (message.hasAttachments() && !sticker && !audio) ? 1 : 0;
        let commands = checkName && this.bot.isBotName(message.getArgs()[0]) ? 1 : 0;
        let incOptions = {
            countSymbols: messageLength,
            countMessages: 1,
            countStickers: sticker,
            countForwards: forwards,
            countAttachments: attachments,
            countAudio: audio,
            countCommands: commands,
        };
        return this._saveLocalStatistics(chat.id, message.user, time, incOptions);
    }

    /**
     *
     * @param {Number} chatId
     * @param {Number} userId
     * @param {Number} time
     * @param {Object} incOptions
     * @return {Promise}
     * @private
     */
    _saveLocalStatistics(chatId, userId, time, incOptions) {
        if (userId === this.bot.selfId) return Promise.resolve();
        return this.savePromise.then(() => {
            let result = Promise.resolve();
            this.statisticsInfo[chatId] = this.statisticsInfo[chatId] || {};
            let chatInfo = this.statisticsInfo[chatId];
            let userInfo = chatInfo[userId];
            // let userDate = new Date(userInfo && userInfo.time || 0);
            // let date = new Date(time);
            // if (userInfo && (userDate.getHours() !== date.getHours() || userDate.getDate() !== date.getDate()
            //     || userDate.getMonth() !== date.getMonth() || userDate.getFullYear() !== date.getFullYear())) {
            //     console.log('new hour statistics');
            //     this.savePromise = this.savePromise
            //         .then(() => this._saveStatisticsToDB(chatId, userId, userInfo.time, userInfo.incOptions))
            //         .then(() => this._saveLocalStatisticsToDB());
            //     chatInfo[userId] = undefined;
            // }
            if (!chatInfo[userId]) {
                chatInfo[userId] = {
                    incOptions,
                    time
                }
            } else {
                this._sumDocs(chatInfo[userId].incOptions, incOptions);
                chatInfo[userId].time = time;
            }
        })
    }

    /**
     *
     * @param {Number} chatId
     * @param {Number} userId
     * @param {Number} time
     * @param {Object} incOptions
     * @return {Promise}
     * @private
     */
    _saveStatisticsToDB(chatId, userId, time, incOptions) {
        let date = new Date(time);
        let promises = [
            // ChatStatistics.findOneAndUpdate({ chatId: chatId },
            //     { $inc: incOptions },
            //     { upsert: true })
            //     .exec()
            //     .catch(console.error)
            // ,
            UserStatistics.update({ chatId: chatId, userId: userId },
                {
                    $inc: incOptions,
                    $set: { _lastActivity: time }
                },
                { upsert: true })
                .exec()
                .catch(console.error)
            ,
            UserHourStatistics.update({
                    chatId: chatId,
                    userId: userId,
                    'date.year': date.getFullYear(),
                    'date.month': date.getMonth(),
                    'date.day': date.getDate(),
                    'date.hours': date.getHours(),
                },
                {
                    $inc: incOptions,
                    $set: { 'date.time': time }
                },
                { upsert: true })
                .exec()
                .catch(console.error)
            ,
        ];
        return promiseFactory.allAsync(promises);
    }

    _saveLocalStatisticsToDB(batchSize = 0) {
        console.log('Statistics start save to db');
        let options = {
            w: 1,
            j: 0,
        };
        let result = Promise.resolve();
        let opsUHS = [];
        let opsUS = [];
        let count = 0;
        for (let chatId of Object.keys(this.statisticsInfo)) {
            let chatInfo = this.statisticsInfo[chatId];
            for (let userId of Object.keys(chatInfo)) {
                let userInfo = chatInfo[userId];
                delete chatInfo[userId];
                let date = new Date(userInfo.time);
                let update = {
                    $inc: userInfo.incOptions,
                };
                opsUHS.push({
                    updateOne: {
                        'filter': {
                            chatId,
                            userId,
                            'date.year': date.getFullYear(),
                            'date.month': date.getMonth(),
                            'date.day': date.getDate(),
                            'date.hours': date.getHours(),
                        },
                        update: Object.assign({}, update, {
                            $set: { 'date.time': userInfo.time },
                        }),
                        upsert: true,
                    }
                });
                opsUS.push({
                    updateOne: {
                        'filter': { chatId, userId },
                        update: Object.assign({}, update, {
                            $set: { _lastActivity: userInfo.time },
                        }),
                        upsert: true,
                    }
                });
                if (batchSize && opsUHS.length > batchSize) {
                    result = result.then(() => UserHourStatistics.bulkWrite(opsUHS, options))
                        .then(() => UserStatistics.bulkWrite(opsUS, options))
                        .then(() => new Promise(resolve => setTimeout(resolve, batchSize*10)));
                    opsUHS = [];
                    opsUS = [];
                }
                count++;
            }
        }
        if (opsUHS.length) result = result
            .then(() => UserHourStatistics.bulkWrite(opsUHS, options))
            .then(() => UserStatistics.bulkWrite(opsUS, options));
        return result
            .then(() => console.log('Statistics end save to db, count: ', count))
            .catch(e => console.error(e));
    }

    _sumDocs(doc, fromDoc) {
        doc.countMessages += fromDoc.countMessages;
        doc.countSymbols += fromDoc.countSymbols;
        doc.countStickers += fromDoc.countStickers;
        doc.countForwards += fromDoc.countForwards;
        doc.countAttachments += fromDoc.countAttachments;
        doc.countAudio += fromDoc.countAudio;
        doc.countCommands += fromDoc.countCommands;
    }

    /**
     *
     * @param {Object} doc1
     * @param {Object} doc2
     * @param {Boolean} skipHours
     * @return {boolean}
     * @private
     */
    _equalDocsDates(doc1, doc2, skipHours = false) {
        return ((skipHours || doc1.date.hours === doc2.date.hours)
            && doc1.date.day === doc2.date.day
            && doc1.date.month === doc2.date.month
            && doc1.date.year === doc2.date.year);
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    statByUser(chat, message, command) {
        let info = command.check.args.exec(message.getCommandText());
        let nameOrId = info[3] || message.user;
        let dmStat = chat.type === 'dm';
        let dmChats = [];
        let period = info[4] || 7;
        let dateName = info[5] || 'дн.';
        let dateMultiplier = dateName.startsWith('час') ? 1 : 24;
        let toMsMultiplier = 60 * 60 * 1000 * dateMultiplier;
        let dateFrom = new Date(Date.now() - (toMsMultiplier * period));
        if (dateMultiplier === 24) dateFrom.setHours(23);
        dateFrom.setMinutes(59, 59, 999);
        let userId = false;
        let query = UserHourStatistics.find();
        let filter = {};
        let map = function () {
            emit(''+this.date.year+this.date.month+this.date.day+this.date.hours, this)
        };
        if (dateMultiplier === 24)
            map = function () {
                emit(''+this.date.year+this.date.month+this.date.day, this)
            };
        let reduce = function (key, values) {
            for (var i = 1; i < values.length; i++) { // don't change to 'let' !
                values[0].countSymbols += values[i].countSymbols;
                values[0].countMessages += values[i].countMessages;
                values[0].countStickers += values[i].countStickers;
                values[0].countForwards += values[i].countForwards;
                values[0].countAttachments += values[i].countAttachments;
                values[0].countAudio += values[i].countAudio;
                values[0].countCommands += values[i].countCommands;
            }
            return values[0];
        };
        if (!info[2] && !dmStat) {
            userId = chat.findUser(nameOrId);
            if (!userId) return message.setTitleTemplate(command.messageTemplate.userFail, nameOrId).send();
            nameOrId = chat.userNames[userId].fullName;
            filter = {chatId: chat.id, userId: userId};
            query = query.where(filter);
        } else if (!dmStat) {
            filter = { chatId: chat.id, userId: { $in: chat.users } };
            query = query.where(filter);
            nameOrId = 'чата';
        } else if (!this.bot.admins.includes(chat.id)) {
            nameOrId = `${chat.name} ${chat.secondName}`;
            userId = chat.id;
            for (let chatId of Object.keys(this.bot.chats)) {
                if (this.bot.chats[chatId].users.includes(userId)) dmChats.push(chatId);
            }
            filter = {userId: chat.id, chatId: {$in: dmChats}};
            query = query.where(filter);
        } else {
            userId = chat.id;
            nameOrId = `всех чатов`;
            let ninUsers = [this.bot.selfId].concat(this.bot.additionalAccounts.map(acc => acc.selfId));
            filter = { userId: { $nin: ninUsers } };
            dmChats = Object.keys(this.bot.chats)
                .filter(chatId => this.bot.chats[chatId].type === 'chat');
        }
        let sum = {
            countSymbols: 0,
            countMessages: 0,
            countStickers: 0,
            countForwards: 0,
            countAttachments: 0,
            countAudio: 0,
            countCommands: 0,
        };
        let template;
        let docs = [];
        let infoChats = [chat.id];
        let infoUsers = [userId];
        let allUsers = false;
        if (info[2] && !dmStat) {
            infoUsers = chat.users;
        } else if (dmStat) {
            infoChats = dmChats;
            if (this.bot.admins.includes(userId)) allUsers = true;
        }
        for (let chatId of infoChats) {
            let chatStatInfo = this.statisticsInfo[chatId];
            if (!chatStatInfo) continue;
            if (allUsers) infoUsers = Object.keys(chatStatInfo);
            for (let userId of infoUsers) {
                if (!chatStatInfo[userId]) continue;
                let doc = new UserHourStatistics(chatStatInfo[userId].incOptions);
                doc.fullDate = new Date(chatStatInfo[userId].time);
                docs.unshift(doc);
            }
        }
        docs.sort((a, b) => b.fullDate - a.fullDate);
        let result = [];
        if (docs.length) {
            let firstDoc = new UserHourStatistics();
            firstDoc.fullDate = docs[0].fullDate;
            result.unshift(firstDoc);
        }
        let skipHours;
        if (dateMultiplier === 24) {
            skipHours = true;
            template = info[1] ? command.messageTemplate.bodyDaysFull : command.messageTemplate.bodyDays;
        } else {
            skipHours = false;
            template = info[1] ? command.messageTemplate.bodyHoursFull : command.messageTemplate.bodyHours;
        }
        let i = 0;
        dmChats = [];
        let onData = doc => {
            if (!dmChats.includes(doc.chatId) && (doc.chatId > 2e9)) dmChats.push(doc.chatId);
            if (!result[i]) {
                result[i] = new UserHourStatistics();
                result[i].fullDate = doc.date.time;
            }
            if (this._equalDocsDates(result[i], doc, skipHours)) {
                this._sumDocs(result[i], doc);
            } else if (++i < period) {
                result[i] = doc;
            } else {
                return;
            }
            this._sumDocs(sum, doc);
        };
        docs.forEach(onData);
        let onEnd = (resolve = () => {}, reject = () => {}) => {
            if (!result.length) {
                return message
                    .setTitleTemplate(command.messageTemplate.titleFail, nameOrId, `${period} ${dateName}`)
                    .send()
                    .then(resolve);
            }
            let titleTemplate = info[1] ? command.messageTemplate.titleFull : command.messageTemplate.title;
            let endTemplate = info[1] ? command.messageTemplate.bodySumFull : command.messageTemplate.bodySum;
            let dateFun = (num) => num > 9 ? num : '0' + num;
            let tempFun = (name, max = 0) => {
                return (i) => {
                    if (!result[i]) return undefined;
                    let statLength = result[i][name].toString().length;
                    let maxLength = max.toString().length;
                    let space = maxLength > statLength ? new Array(maxLength - statLength).fill('&#8194;').join('') : '';
                    return result[i][name] + space;
                }
            };
            return message.setTitleTemplate(titleTemplate, nameOrId, `${period} ${dateName}`, dmChats.length)
                .setBodyTemplate(template,
                    n => dateFun(result[n].date.day), n => dateFun(result[n].date.month + 1),
                    n => result[n].date.year, n => dateFun(result[n].date.hours),
                    tempFun('countSymbols', sum.countSymbols), tempFun('countMessages', sum.countMessages),
                    tempFun('countStickers', sum.countStickers), tempFun('countForwards', sum.countForwards),
                    tempFun('countAttachments', sum.countAttachments), tempFun('countAudio', sum.countAudio),
                    tempFun('countCommands', sum.countCommands))
                .setTemplateLength(result.length)
                .setEndTemplate(endTemplate, sum.countSymbols, sum.countMessages,
                    sum.countStickers, sum.countForwards, sum.countAttachments, sum.countAudio, sum.countCommands)
                .send()
                .then(resolve)
                .catch(reject);
        };
        filter['date.time'] = { $gt: dateFrom.getTime() };
        return UserHourStatistics.mapReduce({
            map,
            reduce,
            query: filter,
            sort: { 'date.time': -1 },
        }).then(docs => {
            docs.sort((a, b) => b.value.date.time - a.value.date.time);
            docs.map(doc => onData(doc.value));
            return onEnd();
        });
        // return new Promise((resolve, reject) => {
        //     query.betweenDates(dateFrom)
        //         .sort('-date.time').cursor()
        //         .on('data', onData)
        //         .on('end', () => onEnd(resolve, reject))
        // })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    statByUserAdmin(chat, message, command) {
        return this.statByUser(chat, message, command);
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    top(chat, message, command) {
        let info = command.check.args.exec(message.getCommandText());
        let timeFrom, timeTo;
        let chatUsers = chat.users.slice();
        let result;
        let time = Date.now();
        if (info[2]) {
            timeTo = time;
            let dateFrom = new Date(timeTo - info[2] * 24 * 60 * 60 * 1000);
            dateFrom.setHours(23, 59, 59, 999);
            timeFrom = dateFrom.getTime();
            message.setTitleTemplate(info[1] ? command.messageTemplate.titleDaysFull
                : command.messageTemplate.titleDays, info[0]);
        } else {
            timeFrom = new Date(`${info[5]}.${info[4]}.${info[3]}`).getTime() || 0;
            timeTo = new Date(`${info[8]}.${info[7]}.${info[6]}`).getTime() || time;
            if (timeFrom !== 0) {
                let from = new Date(timeFrom);
                let to = new Date(timeTo);
                message.setTitleTemplate(info[1] ? command.messageTemplate.titleFull : command.messageTemplate.title,
                    `${from.getDate()}.${from.getMonth()+1}.${from.getFullYear()}`,
                    `${to.getDate()}.${to.getMonth()+1}.${to.getFullYear()}`);
            } else {
                message.setTitleTemplate(info[1] ? command.messageTemplate.titleAllStatFull
                    : command.messageTemplate.titleAllStat);
            }
        }
        let users = chat.users.map(id => {
            return Object.assign({}, chat.userNames[id], { id });
        });
        let chatStatInfo = this.statisticsInfo[chat.id] || {};
        let userMessages = {},
            userSymbols = {},
            userStickers = {},
            userForwards = {},
            userAttachments = {},
            userAudio = {},
            userCommands = {},
            userNames = {};
            // userSecondNames = {}
        let maxLengthMessages = 0,
            maxLengthSymbols = 0,
            maxLengthStickers = 0,
            maxLengthForwards = 0,
            maxLengthAttachments = 0,
            maxLengthAudio = 0,
            maxLengthCommands = 0;
        let sumUser = (userId, doc) => {
            userMessages[userId] += doc.countMessages;
            userSymbols[userId] += doc.countSymbols;
            userStickers[userId] += doc.countStickers;
            userForwards[userId] += doc.countForwards;
            userAttachments[userId] += doc.countAttachments;
            userAudio[userId] += doc.countAudio;
            userCommands[userId] += doc.countCommands;
        };
        for (let user of users) {
            userMessages[user.id] = 0;
            userSymbols[user.id] = 0;
            userStickers[user.id] = 0;
            userForwards[user.id] = 0;
            userAttachments[user.id] = 0;
            userAudio[user.id] = 0;
            userCommands[user.id] = 0;
            userNames[user.id] = user.fullName;
            // userSecondNames[user.id] = user.secondName;
        }
        if (timeFrom === 0) {
            result = UserStatistics.find().where({chatId: chat.id, userId: {$in: chatUsers}});
        } else {
            result = UserHourStatistics.find().betweenDates(new Date(timeFrom), new Date(timeTo))
                .where({chatId: chat.id, userId: {$in: chatUsers}});
        }
        let tempFun = (r, max = 0) => {
            return (i) => {
                if (!chatUsers[i] || r[chatUsers[i]] === undefined) return undefined;
                let statLength = r[chatUsers[i]].toString().length;
                let maxLength = max.toString().length;
                let space = (info[1] && maxLength > statLength) ? new Array(maxLength - statLength).fill('&#8194;').join('') : '';
                return r[chatUsers[i]] + space;
            }
        };
        return new Promise((resolve, reject) => {
            result.cursor()
                .on('data', doc => {
                    sumUser(doc.userId, doc);
                })
                .on('end', () => {
                    for (let user of users) {
                        maxLengthMessages = userMessages[user.id] > maxLengthMessages ? userMessages[user.id] : maxLengthMessages;
                        maxLengthSymbols = userSymbols[user.id] > maxLengthSymbols ? userSymbols[user.id] : maxLengthSymbols;
                        maxLengthStickers = userStickers[user.id] > maxLengthStickers ? userStickers[user.id] : maxLengthStickers;
                        maxLengthForwards = userForwards[user.id] > maxLengthForwards ? userForwards[user.id] : maxLengthForwards;
                        maxLengthAttachments = userAttachments[user.id] > maxLengthAttachments ? userAttachments[user.id] : maxLengthAttachments;
                        maxLengthAudio = userAudio[user.id] > maxLengthAudio ? userAudio[user.id] : maxLengthAudio;
                        maxLengthCommands = userCommands[user.id] > maxLengthCommands ? userCommands[user.id] : maxLengthCommands;
                        if (chatStatInfo[user.id] && timeTo === time) {
                            sumUser(user.id, chatStatInfo[user.id].incOptions);
                        }
                    }
                    chatUsers.sort((a, b) => userSymbols[b] - userSymbols[a]);
                    let getActivity = (date => {
                        if (date > timeFrom) {
                            let days = Math.floor((Date.now() - date)/(24 * 36e5));
                            if (isNaN(days)) return '';
                            return `(за ${days} дн.)`;
                        }
                        return '';
                    });
                    return promiseFactory
                        .allAsync(chatUsers.map(userId => this._findFirstActivity(chat, userId)))
                        .then(usersActivity => {
                            return message.setBodyTemplate(
                                info[1] ? command.messageTemplate.bodyFull : command.messageTemplate.body,
                                n => n+1, tempFun(userNames),
                                tempFun(userSymbols, maxLengthSymbols), tempFun(userMessages, maxLengthMessages),
                                tempFun(userStickers, maxLengthStickers), tempFun(userForwards, maxLengthForwards),
                                tempFun(userAttachments, maxLengthAttachments), tempFun(userAudio, maxLengthAudio),
                                tempFun(userCommands, maxLengthCommands),
                                n => getActivity(usersActivity[n])
                            )
                                .send()
                                .then(resolve)
                                .catch(reject);
                        })
                });
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    chatTop(chat, message, command) {
        let info = command.check.args.exec(message.getCommandText());
        let recordsCount = 10;
        let typeName = info[1];
        let type;
        switch (typeName) {
            case 'символам':
                type = 'countSymbols';
                break;
            case 'сообщениям':
                type = 'countMessages';
                break;
            case 'стикерам':
                type = 'countStickers';
                break;
            case 'пересылкам':
                type = 'countForwards';
                break;
            case 'прикреплениям':
                type = 'countAttachments';
                break;
            case 'голосовым':
                type = 'countAudio';
                break;
            case 'командам':
                type = 'countCommands';
                break;
            default:
                typeName = 'символам';
                type = 'countSymbols';
                break;
        }
        let top = [];
        let dayDoc = new UserHourStatistics();
        dayDoc.fullDate = new Date();
        if (this.statisticsInfo[chat.id]) {
            for (let userId of Object.keys(this.statisticsInfo[chat.id])) {
                if (userId === this.bot.selfId || !this.statisticsInfo[chat.id][userId]) continue;
                this._sumDocs(dayDoc, this.statisticsInfo[chat.id][userId]);
            }
        }
        return UserHourStatistics.find({ chatId: chat.id }).sort('-date.time').cursor()
            .on('data', doc => {
                if (doc.userId === this.bot.selfId) return;
                if (this._equalDocsDates(dayDoc, doc, true)) {
                    this._sumDocs(dayDoc, doc);
                } else {
                    top.push(dayDoc);
                    dayDoc = doc;
                    if (top.length > recordsCount) {
                        top.sort((a,b) => b[type] - a[type]);
                        top.pop();
                    }
                }
            })
            .on('end', () => {
                let max = {
                    countSymbols: 0,
                    countMessages: 0,
                    countStickers: 0,
                    countForwards: 0,
                    countAttachments: 0,
                    countAudio: 0,
                    countCommands: 0,
                };
                if (!top.length) top = [dayDoc];
                else if (top[top.length - 1][type] < dayDoc[type]) {
                    top.sort((a,b) => b[type] - a[type]);
                    top.pop();
                }
                for (let dayDoc of top) {
                    for (let countName of Object.keys(max)) {
                        if (max[countName] < dayDoc[countName]) max[countName] = dayDoc[countName];
                    }
                }
                let dateFun = (num) => num > 9 ? num : '0' + num;
                let tempFun = (name) => {
                    return (i) => {
                        if (!top[i]) return undefined;
                        let statLength = top[i][name].toString().length;
                        let maxLength = max[name].toString().length;
                        let space = maxLength > statLength ? new Array(maxLength - statLength).fill('&#8194;').join('') : '';
                        return top[i][name] + space;
                    }
                };
                return message.setTitleTemplate(command.messageTemplate.title, typeName)
                    .setBodyTemplate(command.messageTemplate.body, n => dateFun(top[n].date.day),
                        n => dateFun(top[n].date.month + 1), n => top[n].date.year,
                        tempFun('countSymbols'), tempFun('countMessages'), tempFun('countStickers'),
                        tempFun('countForwards'), tempFun('countAttachments'), tempFun('countAudio'),
                        tempFun('countCommands'))
                    .setTemplateLength(Math.min(recordsCount, top.length))
                    .send()
            });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    botChatsTop(chat, message, command) {
        return this.botChatsTopPromise = this.botChatsTopPromise.then(() => new Promise(resolve => {
            let chats = [];
            let chatsInfo = {};
            let numTop = 15;
            let minChatsToLoadMessage = 400;
            for (let chat of this.chats) {
                if (chat.type === 'chat') {
                    chats.push(chat);
                    chatsInfo[chat.id] = {
                        sum: 0,
                        chatId: chat.id,
                    }
                }
            }
            let dateFrom = new Date(Date.now() - 2 * 24 * 36e5);
            dateFrom.setHours(23, 60, 60, 999);
            let dateTo = new Date(Date.now() - 24 * 36e5);
            dateTo.setHours(23, 60, 60, 999);
            let onEnd = () => {
                // if (!this.botChatsTopInfo || !this.botChatsTopDate || dateTo.getTime() !== this.botChatsTopDate.getTime()) {
                    this.botChatsTopInfo = chatsInfo;
                    this.botChatsTopDate = dateTo;
                // }
                if (this.bot.clusterMode) {
                    this.bot.clusterMode.send({
                        topic: 'statisticsBotChatsTop',
                        data: {
                            botChatsTopInfo: this.botChatsTopInfo,
                            botChatsTopDate: this.botChatsTopDate.getTime(),
                        },
                    });
                }
                let result = [];
                let thisChat;
                for (let id of Object.keys(chatsInfo)) {
                    result.push(chatsInfo[id]);
                    if (chatsInfo[id].chatId === chat.id) {
                        thisChat = chatsInfo[id]
                    }
                }
                result.sort((a, b) => b.sum - a.sum);
                message.new.setTitleTemplate(command.messageTemplate.title, numTop)
                    .setBodyTemplate(
                        command.messageTemplate.body,
                        n => n + 1,
                        n => {
                            let chat = this.bot.chats[result[n].chatId];
                            if (!chat) return result[n].chatId;
                            let title = chat.title.replace(/(]|&#93;)/, '&#8969;');
                            return `[id${chat.adminId}|${title}]`
                        },
                        n => result[n].chatId - 2e9,
                        n => result[n].sum
                    )
                    .setTemplateLength(Math.min(result.length, numTop));
                if (result.indexOf(thisChat) >= numTop && thisChat) {
                    message.setEndTemplate(
                        command.messageTemplate.end,
                        result.indexOf(thisChat),
                        this.bot.chats[thisChat.chatId].title,
                        thisChat.chatId - 2e9,
                        thisChat.sum
                    );
                }
                resolve(message.send());
            };

            if (this.botChatsTopInfo && this.botChatsTopDate && dateTo.getTime() === this.botChatsTopDate.getTime()) {
                if (Object.keys(this.botChatsTopInfo).length === chats.length) {
                    chatsInfo = this.botChatsTopInfo;
                    return onEnd();
                } else {
                    chats = chats.filter(chat => !(chat.id in this.botChatsTopInfo));
                    chatsInfo = Object.assign(chatsInfo, this.botChatsTopInfo);
                }
            }
            let promises = chats.map(chat => () => {
                if (this.ignoreChats.includes(chat.id)) return;
                return UserHourStatistics.find({ chatId: chat.id, userId: { $in: chat.users }, countSymbols: { $lt: 1e4 } })
                    .betweenDates(dateFrom, dateTo)
                    .exec()
                    .then(docs => {
                        docs.map(doc => chatsInfo[chat.id].sum += doc.countSymbols);
                    });
            });
            if (chats.length > minChatsToLoadMessage) {
                promises.unshift(() => message.new.setTitleTemplate(command.messageTemplate.titleLoad).send());
            }
            return promiseFactory.allSync(promises).then(() => onEnd());
        }));
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    activity(chat, message, command) {
        return this._getUsersActivity(chat).then(users => {
            users.map(user => {
                if (user.lastActivity) {
                    let time = new Date() - new Date(user.lastActivity);
                    user.lastActivityDesc = this._periodToText(time);
                } else user.lastActivityDesc = command.messageTemplate.userFail;
            });
            return message.setTitleTemplate(command.messageTemplate.title)
                .setBodyTemplate(
                    command.messageTemplate.body,
                    n=> n + 1,
                    n => chat.userNames[users[n].id].fullName,
                    n => users[n].lastActivityDesc
                )
                .setTemplateLength(users.length)
                .send();
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    communication(chat, message, command) {
        let info = command.check.args.exec(message.getCommandText());
        let nameOrId = info[1] || message.user;
        let chatUsers = chat.users.slice();
        let userId = chat.findUser(nameOrId);
        if (!userId) return message.setTitleTemplate(command.messageTemplate.userFail, nameOrId).send();
        message.setTitleTemplate(command.messageTemplate.wait, chat.userNames[userId].fullName).send();
        chatUsers.splice(chatUsers.indexOf(userId), 1);
        let usersInfo = {};
        for (let id of chatUsers) usersInfo[id] = 0;
        let usersInfoTmp = {};
        let time = 0;
        let counter = 0;
        let incUserInfo = (id, array = usersInfo, inc = 1) => {
            // if (chatUsers.includes(+id) && +id !== userId) {
                if (!array[id]) array[id] = 0;
                array[id] += inc;
            // }
        };
        return new Promise(resolve => {
            this.bot.vk.collect.messages.getHistory({
                peer_id: chat.id,
                count: chat.users.length * 1000,
            }).on('data', items => {
                for (let message of items) {
                    if (message.from_id === userId && message.fwd_messages) {
                        for (let fwd of message.fwd_messages) {
                            incUserInfo(fwd.user_id, usersInfo);
                        }
                        counter = 0;
                    } else if (message.from_id !== userId) {
                        if (time - message.date < 60 || counter < 15) {
                            counter++;
                            usersInfoTmp[message.from_id] = usersInfoTmp[message.from_id] || 1;
                        }
                    } else {
                        time = message.date;
                        counter = 0;
                        for (let id of Object.keys(usersInfoTmp)) {
                            incUserInfo(id, usersInfo, usersInfoTmp[id]);
                        }
                        usersInfoTmp = {};
                    }
                }
            }).on('end', () => {
                let sum = 0;
                for (let id of Object.keys(usersInfo)) {
                    if (chatUsers.includes(+id) && +id !== userId) {
                        sum += usersInfo[id];
                    }
                }
                chatUsers.sort((a, b) => usersInfo[b] - usersInfo[a]);
                let result = message.new.setTitleTemplate(command.messageTemplate.title, chat.userNames[userId].fullName)
                    .setBodyTemplate(
                        command.messageTemplate.body,
                        n => n + 1,
                        n => chat.userNames[chatUsers[n]].fullName,
                        n => {
                            let per = (Math.floor(usersInfo[chatUsers[n]] * 100 / sum)) || 0;
                            return per || undefined;
                        }
                    )
                    .setTemplateLength(chatUsers.length)
                    .send();
                resolve(result);
            });
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} messagePre
     * @param {SpecificationCommand} command
     */
    parseStat(chat, messagePre, command) {
        if (this.parseChat[chat.id]) {
            return messagePre.setTitleTemplate(command.messageTemplate.sessionFail).send();
        }
        const parse = (message) => {
            const iterationCount = 5000;
            let inc = {
                countSymbols: 0,
                countMessages: 0,
                countStickers: 0,
                countForwards: 0,
                countAttachments: 0,
                countAudio: 0,
                countCommands: 0,
            };
            let chatStat = Object.assign({}, inc);
            let userStat = {};
            let userHourStat = {};
            if (this.parseChat[chat.id] ||
                message.user !== messagePre.user) {
                return;
            } else if (/^нет ?/i.test(message.text)) {
                return chat.removeListenerOn(chat.eventNames.message, parse);
            } else if (!/^да ?/i.test(message.text)) return;
            this.parseChat[chat.id] = true;
            let resultPromise = Promise.resolve();
            resultPromise.then(() => ChatStatistics.remove({chatId: chat.id}).exec());
            resultPromise = resultPromise.then(() => UserStatistics.remove({chatId: chat.id}).exec());
            resultPromise = resultPromise.then(() => UserHourStatistics.remove({chatId: chat.id}).exec());
            const informate = (thisCount, allCount) => {
                let times = 10;
                if (allCount > 1000000) times = 25;
                if (allCount > 2000000) times = 50;
                if (Math.floor(thisCount / allCount * times) !== Math.floor((thisCount - iterationCount) / allCount * times)
                    && Math.floor(thisCount / allCount * times) > 0) {
                    return message.new
                        .setTitleTemplate(command.messageTemplate.parseInfo,
                            Math.floor(thisCount / allCount * 100))
                        .send();
                }
            };
            const parseIterations = (count) => {
                let iErr = -1;
                for (let i = 0; i * iterationCount < count; i++) {
                    resultPromise = resultPromise.then(() => (
                        this.bot.vk.collect.messages.getHistory({
                            peer_id: chat.id,
                            count: iterationCount,
                            offset: i * iterationCount,
                        }).catch(err => {
                            if (i === iErr) {
                                console.error(err);
                            } else {
                                iErr = i;
                                i--;
                            }
                            return [];
                        })
                    )).then((items) => {
                        if (!Array.isArray(items)) return;
                        let promises = [];
                        let ops = [];
                        for (let j = 0; j < items.length; j++) {
                            let item = items[j];
                            if (item.body.replace(/[^a-zа-яё]/gi, '').length > this.maxMessageLength) continue;
                            let userId = item.from_id;
                            let time = item.date * 1000;
                            let date = new Date(time);
                            let docDate = new Date(userHourStat[userId] && userHourStat[userId].time || 0);
                            if (!userHourStat[userId]
                                || docDate.getHours() !== date.getHours()
                                || docDate.getDate() !== date.getDate()
                                || docDate.getMonth() !== date.getMonth()
                                || docDate.getFullYear() !== date.getFullYear()) {
                                if (userHourStat[userId]) {
                                    ops.push({
                                        updateOne: {
                                            'filter': {
                                                chatId: chat.id,
                                                userId,
                                                'date.year': docDate.getFullYear(),
                                                'date.month': docDate.getMonth(),
                                                'date.day': docDate.getDate(),
                                                'date.hours': docDate.getHours(),
                                            },
                                            update: {
                                                $inc: userHourStat[userId].inc,
                                                $set: { 'date.time': userHourStat[userId].time },
                                            },
                                            upsert: true,
                                        }
                                    });
                                }
                                userHourStat[userId] = {
                                    time,
                                    inc: Object.assign({}, inc),
                                };
                            }
                            if (!userStat[userId]) {
                                userStat[userId] = Object.assign({}, inc);
                            }
                            let incOptions = {
                                countSymbols: item.body.replace(/[^a-zа-яё]/gi, '').length,
                                countMessages: 1,
                                countStickers: (item.attachments && item.attachments.sticker) ? 1 : 0,
                                countForwards: item.fwd_messages ? 1 : 0,
                                countAudio: (item.attachments
                                    && item.attachments[0].doc
                                    && item.attachments[0].doc.type === 5) ? 1 : 0,
                                countCommands: this.bot.isBotName(item.body.split(' ')[0]) ? 1 : 0,
                            };
                            incOptions.countAttachments = (item.attachments
                                && !incOptions.countStickers
                                && !incOptions.countAudio) ? 1 : 0;
                            this._sumDocs(userHourStat[userId].inc, incOptions);
                            this._sumDocs(userStat[userId], incOptions);
                        }
                        if (ops.length)
                            return promiseFactory.allAsync([
                                UserHourStatistics.bulkWrite(ops),
                                informate(i * iterationCount, count, iterationCount),
                            ]);
                    }).catch(err => (console.error(err) || true));
                }
                resultPromise.catch(err => console.error(err) || true)
                    .then(() => {
                    this.parseChat[chat.id] = false;
                    let promises = [];
                    let opsUHS = [];
                    let opsUS = [];
                    for (let userId of Object.keys(userStat)) {
                        opsUS.push({
                            updateOne: {
                                'filter': {
                                    chatId: chat.id,
                                    userId,
                                },
                                update: {
                                    $inc: userStat[userId],
                                },
                                upsert: true,
                            }
                        });
                        let date = new Date(userHourStat[userId].time);
                        opsUHS.push({
                            updateOne: {
                                'filter': {
                                    chatId: chat.id,
                                    userId,
                                    'date.year': date.getFullYear(),
                                    'date.month': date.getMonth(),
                                    'date.day': date.getDate(),
                                    'date.hours': date.getHours(),
                                },
                                update: {
                                    $inc: userHourStat[userId].inc,
                                    $set: { 'date.time': userHourStat[userId].time },
                                },
                                upsert: true,
                            }
                        });
                    }
                    return promiseFactory.allAsync([
                        UserStatistics.bulkWrite(opsUS),
                        UserHourStatistics.bulkWrite(opsUHS),
                    ])
                        .then(() => message.new.setBody(command.messageTemplate.end).send());
                }).catch(err => console.error(err))
            };

            return this.bot.vk.api.messages.getHistory({
                peer_id: chat.id,
                count: 0,
            })
                .then((hist) => {
                    parseIterations(hist.count);
                    return message.new.setTitleTemplate(command.messageTemplate.start, hist.count).send();
                });
        };
        setTimeout(() => chat.removeListenerOn(chat.eventNames.message, parse), 60000);
        return messagePre.setTitle(command.messageTemplate.confirm).send()
            .then(() => chat.on(chat.eventNames.message, parse, this));
    }

    /**
     *
     * @param {Chat|*} [chat]
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    allStat(chat, message, command) {
        let info = command.check.args.exec(message.getCommandText());
        let period = info[1];
        let dateMultiplierHours = info[2];
        let dateMultiplier = dateMultiplierHours ? 1 : 24;
        let toMsMultiplier = 60 * 60 * 1000 * dateMultiplier;
        let chatIdOrName = info[3];
        let chatType = 'chat';
        let chatId;
        let userIdOrName = info[4];
        let userId;
        let groupBy = info[5];
        let sortBy = info[6];
        let reverse = info[7];
        let query = UserHourStatistics.find();
        // find needed
        if (!isNaN(chatIdOrName) && chatIdOrName > 0) {
            chatId = +chatIdOrName;
        } else if (chatIdOrName) {
            let regExp = new RegExp(chatIdOrName, 'i');
            for (let id of Object.keys(this.bot.chats)) {
                if (chatId || chatType !== this.bot.chats[id].type) continue;
                if (chatType === 'chat' && regExp.test(this.bot.chats[id].title)) chatId = id;
                if (chatType === 'dm' && this.bot.chats[id].findUser(chatIdOrName)) chatId = id;
            }
        }
        if (chatId && chatType === 'chat' && chatId < 2e9) chatId += 2e9;
        if (userIdOrName) {
            for (let id of Object.keys(this.bot.chats)) {
                if (userId) continue;
                userId = this.bot.chats[id].findUser(userIdOrName);
                if (userId) userIdOrName = this.bot.chats[id].userNames[userId];
            }
        }
        // set query
        let resultDocs = [];
        let onData = (key, doc) => {
            if (!resultDocs.length) return resultDocs.push(doc);
            if (resultDocs[resultDocs.length-1][key] === doc[key])
                this._sumDocs(resultDocs[resultDocs.length-1], doc);
            else resultDocs.push(doc);
        };
        let onEnd = () => null;
        let tempFun = n => '';
        if (chatId) query = query.where({ chatId });
        if (userId) query = query.where({ userId });
        if (period) query = query.betweenDates(new Date(Date.now() - period * toMsMultiplier));
        if ('юзер'.includes(groupBy)) {
            query = query.sort('userId');
            onData = onData.bind(this, 'userId');
            onEnd = () => {
                for (let id of Object.keys(this.bot.chats)) {
                    resultDocs.forEach(doc => {
                        if (this.bot.chats[id].users.includes(doc.userId)) {
                            let user = this.bot.chats[id].userNames[doc.userId];
                            doc._doc.userId = `${user.fullName}`;
                        }
                    });
                }
            };
            tempFun = n => resultDocs[n].userId;
        } else if ('день'.includes(groupBy) || 'час'.includes(groupBy)) {
            query = query.sort('date.time');
            let skipHours = 'день'.includes(groupBy);
            onData = doc => {
                if (!resultDocs.length) return resultDocs.push(doc);
                if (this._equalDocsDates(resultDocs[resultDocs.length-1], doc, skipHours)) {
                    this._sumDocs(resultDocs[resultDocs.length-1], doc);
                } else resultDocs.push(doc);
            };
            let nf = n => (n > 9 && n || `0${n}`);
            tempFun = n => {
                let text = `${nf(resultDocs[n].date.day)}.${nf(resultDocs[n].date.month+1)}.${nf(resultDocs[n].date.year)}`;
                if ('час'.includes(groupBy)) text += ` в ${nf(resultDocs[n].date.hours)}`;
                return text;
            };
        } else {
            query = query.sort('chatId');
            onData = onData.bind(this, 'chatId');
            onEnd = () => {
                resultDocs.forEach(doc => {
                    if (this.bot.chats[doc.chatId]) {
                        if (this.bot.chats[doc.chatId].type === 'chat') {
                            doc._doc.chatId = `(#${doc.chatId-2e9}) ${this.bot.chats[doc.chatId].title}`;
                        } else {
                            doc._doc.chatId = `(#${doc.chatId}) ${this.bot.chats[doc.chatId].name} ${this.bot.chats[doc.chatId].secondName}`;
                        }
                    }
                });
            };
            tempFun = n => `чат ${resultDocs[n].chatId}`;
        }
        // find docs
        return new Promise((resolve, reject) => {
            let sum = new UserHourStatistics;
            query.find().cursor()
                .on('data', doc => {
                    onData(doc);
                    if (sum.countMessages < doc.countMessages) sum.countMessages = doc.countMessages;
                    if (sum.countSymbols < doc.countSymbols) sum.countSymbols = doc.countSymbols;
                    if (sum.countStickers < doc.countStickers) sum.countStickers = doc.countStickers;
                    if (sum.countForwards < doc.countForwards) sum.countForwards = doc.countForwards;
                    if (sum.countAttachments < doc.countAttachments) sum.countAttachments = doc.countAttachments;
                    if (sum.countAudio < doc.countAudio) sum.countAudio = doc.countAudio;
                    if (sum.countCommands < doc.countCommands) sum.countCommands = doc.countCommands;
                })
                .on('end', () => {
                    if (!resultDocs.length) {
                        return message.setTitle(command.messageTemplate.emptyFail).createReply().send();
                    }
                    onEnd();
                    // sort
                    if ('символы'.includes(sortBy) || !sortBy) {
                        resultDocs.sort((a, b) => b.countSymbols - a.countSymbols);
                    } else if ('сообщения'.includes(sortBy)) {
                        resultDocs.sort((a, b) => b.countMessages - a.countMessages);
                    } else if ('стикеры'.includes(sortBy)) {
                        resultDocs.sort((a, b) => b.countStickers - a.countStickers);
                    } else if ('пересылки'.includes(sortBy)) {
                        resultDocs.sort((a, b) => b.countForwards - a.countForwards);
                    } else if ('прикрепления'.includes(sortBy)) {
                        resultDocs.sort((a, b) => b.countAttachments - a.countAttachments);
                    } else if ('голосовые'.includes(sortBy)) {
                        resultDocs.sort((a, b) => b.countAudio - a.countAudio);
                    } else if ('команды'.includes(sortBy)) {
                        resultDocs.sort((a, b) => b.countCommands - a.countCommands);
                    }
                    if (reverse) {
                        resultDocs.reverse();
                    }

                    // set text
                    let title = '';
                    if (chatId) {
                        if (chatType === 'chat') {
                            title += ` чата '${this.bot.chats[chatId] && this.bot.chats[chatId].title.substr(0, 10) || chatId}'`;
                        } else {
                            let chat = this.bot.chats[chatId];
                            let userFullName = chat ? `${chat.name} ${chat.secondName}` : chatId;
                            title += ` диалога c ${userFullName}`;
                        }
                    }
                    if (userId) title += ` пользователя ${userIdOrName.name} ${userIdOrName.secondName}`;
                    if (period) title += ` за ${period} ${dateMultiplierHours || 'дн.'}`;


                    let paginationNumInPage = 30;
                    let dataFun = (name, max = 0) => {
                        return (i) => {
                            if (!resultDocs[i]) return undefined;
                            let statLength = resultDocs[i][name].toString().length;
                            let maxLength = max.toString().length;
                            let space = maxLength > statLength ? new Array(maxLength - statLength).fill('&#8194;').join('') : '';
                            return resultDocs[i][name] + space;
                        }
                    };
                    let sendFun = end => {
                        return message.new.setTitleTemplate(command.messageTemplate.titleFull, title)
                            .setBodyTemplate(command.messageTemplate.bodyFull, tempFun,
                                dataFun('countSymbols', sum.countSymbols), dataFun('countMessages', sum.countMessages),
                                dataFun('countStickers', sum.countStickers), dataFun('countForwards', sum.countForwards),
                                dataFun('countAttachments', sum.countAttachments), dataFun('countAudio', sum.countAudio),
                                dataFun('countCommands', sum.countCommands))
                            .setTemplateLength(Math.min(resultDocs.length, paginationNumInPage))
                            .setEnd(end || '')
                            .send();
                    };
                    if (resultDocs.length > paginationNumInPage) {
                        let end = `напиши 'еще', чтобы увидеть больше`;
                        let onMessage;
                        let stop = () => chat.removeListenerOn(chat.eventNames.message, onMessage);
                        let timeout;
                        let next = () => {
                            clearTimeout(timeout);
                            if (resultDocs.length <= paginationNumInPage) {
                                return stop().then(() => resultDocs.length && sendFun());
                            }
                            timeout = setTimeout(stop, 6e4);
                            return sendFun(end).then(() => resultDocs.splice(0, paginationNumInPage));
                        };
                        onMessage = nextMessage => {
                            if (this.validateCommand(chat, nextMessage, command.check)) return stop();
                            if (nextMessage.user !== message.user || !/^[её]щ[её]/i.test(nextMessage.getCommandText())) return;
                            return next();
                        };
                        return chat.on(chat.eventNames.message, onMessage, this).then(next).then(resolve).catch(reject);
                    } else return sendFun().then(resolve).catch(reject);
                })
        })
    }
};
