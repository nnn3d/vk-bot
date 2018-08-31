'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const ChatStatistics = require('../Statistics/ChatStatistics');
const UserStatistics = require('../../classes/db/UserStatistics');
const UserHourStatistics = require('../../classes/db/UserHourStatistics');
const promiseFactory = require('../../helpers/promiseFactory');
const Quiche = require('quiche');

module.exports = class Charts extends ModuleEventController {

    /**
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            commandList: {
                name: 'Графики (статистика)',
                description: 'Показывает информацию из модуля статистики в виде графиков',
            },
            vip: {
                paid: false,
            },
            web: {
                icon: {
                    name: 'FaAreaChart',
                    options: {
                        color: '#a0ea78',
                    }
                },
            },
            commands: [
                {
                    name: 'averageChart',
                    vip: {
                        usages: 10,
                    },
                    check: {
                        args: /^график среднее(?: за)? (день|недел[яю])( в? ?проц[а-я]*)?(?: ([a-zа-яё]+? ?[a-zа-яё]*?|\d{4,}))?(?: (?:(\d{1,3})(?:[^\d.\-]|$)|(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})(?:[\D]*(\d{1,2})[.\-](\d{1,2})[.\-](\d{4}))?))?$/i,
                        type: 'chat',
                    },
                    commandList: {
                        name: 'усредненный график статистики',
                        usage: `график среднее день {имя пользователя}`,
                        description: 'график среднее [(день) или (неделя)] {(в процентах)} {[имя пользователя [ + фамилия ]] или [id пользователя]} {[количество дней] или [начальная дата]} {[конечная дата]} - например, "график среднее день" - покажет график средней дневной активности за все время всех пользователей, "график среднее неделя иван иванов" - покажет график средней дневной активности за все время пользователя иван иванов, "график среднее неделя 5" покажет график за последние 5 дней, "график среднее день иван иванов 1.1.2000 1.2.2000" покажет график с информацией с 1.1.2000 по 1.2.2000',
                    },
                    web: {
                        disableReload: false,
                        filter: (props, chat, message) => {
                            let chatStat = props && props.opts.includes('chat');
                            return {
                                opts: {
                                    type: 'checkbox',
                                    options: {
                                        placeholder: 'параметры',
                                    },
                                    data: [
                                        {
                                            label: 'график чата',
                                            value: 'chat',
                                        },
                                        {
                                            label: 'за неделю',
                                            value: 'week',
                                        },
                                        {
                                            label: 'в процентах',
                                            value: 'percent',
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
                                        default: id === message.user,
                                    })),
                                },
                                interval: {
                                    type: 'select',
                                    data: new Array(7).fill(1).map((el, num) => ({
                                        label: `за ${el+num} нед.`,
                                        value: el+num,
                                        default: el+num === 1,
                                    }))
                                }
                            }
                        },
                        output: props => {
                            let out = `график среднее `;
                            out += props.opts.includes('week') ? 'неделя' : 'день';
                            if (props.opts.includes('percent')) out += ` процент`;
                            if (!props.opts.includes('chat') && props.user) out += ` ${props.user}`;
                            out +=` ${props.interval * (props.opts.includes('week') ? 1 : 7)}`;
                            return out;
                        }
                    }
                },
                {
                    name: 'averageChartDm',
                    check: {
                        args: /^график среднее(?: за)? (день|недел[яю])(?!!(!))?(?: (?:(\d{1,3})(?:[^\d.\-]|$)|(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})(?:[\D]*(\d{1,2})[.\-](\d{1,2})[.\-](\d{4}))?))?$/i,
                        type: 'dm',
                        admin: true,
                    },
                    commandList: {
                        name: 'усредненный график статистики',
                        usage: `график среднее день`,
                        description: 'график среднее [(день) или (неделя)] {[количество дней] или [начальная дата]} {[конечная дата]} - например, "график среднее день" - покажет график средней дневной активности за все время всех пользователей, "график среднее неделя иван иванов" - покажет график средней дневной активности за все время пользователя иван иванов, "график среднее неделя 5" покажет график за последние 5 дней, "график среднее день иван иванов 1.1.2000 1.2.2000" покажет график с информацией с 1.1.2000 по 1.2.2000',
                    },
                },
            ],
        };
    }

    /**
     *
     * @return {Quiche}
     * @private
     */
    _createChart() {
        let bar = new Quiche('line');
        bar.setWidth(600);
        bar.setHeight(350);
        // bar.setBarWidth(12);
        // bar.setBarSpacing(1); // 6 pixles between bars/groups
        bar.setLegendBottom(); // Put legend at bottom
        // bar.setTransparentBackground(); // Make background transparent
        bar.setAutoScaling(); // Auto scale y axis
        return bar;
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    averageChartDm(chat, message, command) {
        return this.averageChart(chat, message, command);
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    averageChart(chat, message, command) {
        let info = command.check.args.exec(message.getCommandText());
        let timeFrom, timeTo, title = '';
        let query = UserHourStatistics.find();
        let byDays = info[1].startsWith('день');
        let weekMultiplier = byDays ? 1 : 7;
        let percentage = info[2];
        let nameOrId = info[3];
        let daysOrWeeks = info[4];
        let dateInfo = info.slice(5, 11);
        if (daysOrWeeks) {
            query = query.betweenDates(Date.now() - daysOrWeeks * weekMultiplier * 24 * 36e5);
            title = `за ${daysOrWeeks} ${byDays ? 'дн.' : 'нед.'}`;
        } else if (dateInfo[0] && dateInfo[1] && dateInfo[2]) {
            timeFrom = new Date(`${dateInfo[2]}.${dateInfo[1]}.${dateInfo[0]}`).getTime() || 0;
            timeTo = new Date(`${dateInfo[5]}.${dateInfo[4]}.${dateInfo[3]}`).getTime() || Date.now();
            query = query.betweenDates(new Date(timeFrom), new Date(timeTo));
            if (timeTo === new Date(`${dateInfo[5]}.${dateInfo[4]}.${dateInfo[3]}`).getTime()) {
                title += `за ${dateInfo[0]}.${dateInfo[1]}.${dateInfo[2]} - ${dateInfo[3]}.${dateInfo[4]}.${dateInfo[5]}`;
            } else {
                title = `c ${dateInfo[0]}.${dateInfo[1]}.${dateInfo[2]}`;
            }
        }
        let resultInfo = {
            countSymbols: new Array(byDays ? 24 : 7).fill(0),
            countMessages: new Array(byDays ? 24 : 7).fill(0),
            countStickers: new Array(byDays ? 24 : 7).fill(0),
            countForwards: new Array(byDays ? 24 : 7).fill(0),
            countAttachments: new Array(byDays ? 24 : 7).fill(0),
            countAudio: new Array(byDays ? 24 : 7).fill(0),
            countCommands: new Array(byDays ? 24 : 7).fill(0),
        };
        let resultMax = {};
        Object.keys(resultInfo).map(key => {
            resultMax[key] = 0;
        });
        let count;
        let result = Promise.resolve();
        if (nameOrId) {
            result = this.bot.vk.api.users.get({
                user_ids: chat.users.join(',')
            }).then(users => {
                let userInfo;
                users.forEach(user => {
                    let nameExp = new RegExp(`^${nameOrId}`, 'i');
                    if (nameExp.test(`${user.first_name} ${user.last_name}`)
                        || nameExp.test(`${user.last_name} ${user.first_name}`)
                        || nameExp.test(user.id)) {
                        userInfo = user;
                    }
                });
                return userInfo;
            });
        }
        return result.then(userInfo => new Promise((resolve) => {
            if (userInfo) {
                query = query.where({ userId: userInfo.id });
            }
            if (!this.bot.admins.includes(chat.id)) {
                query = query.where({ chatId: chat.id }).sort('date.year date.month date.day date.hours');
            }
            query.cursor({batchSize:500}).on('data', doc => {
                let key = byDays ? doc.date.hours : (doc.fullDate.getDay() || 7) - 1;
                for (let n of Object.keys(resultInfo)) {
                    resultInfo[n][key] += n === 'countSymbols' && doc[n] * 0.01 || doc[n];
                }
                if (!count) count = (Date.now() - doc.fullDate.getTime()) / (24 * 36e5 * (byDays ? 1 : 7));
            }).on('end', () => {
                for (let n of Object.keys(resultInfo)) {
                    for (let i = 0; i < (byDays ? 24 : 7); i++) {
                        resultInfo[n][i] = resultInfo[n][i] / count || 0;
                        resultMax[n] += resultInfo[n][i];
                    }
                    if (percentage) {
                        for (let i = 0; i < (byDays ? 24 : 7); i++) {
                            resultInfo[n][i] /= (resultMax[n] / 100 || 1);
                        }
                    }
                }
                let bar = this._createChart();
                let userTitle = userInfo ? `${userInfo.first_name} ${userInfo.last_name}` : 'чата';
                if (this.bot.admins.includes(chat.id)) userTitle = 'всех чатов';
                if (percentage) title += ' в процентах';
                bar.setTitle(`Средняя активность ${userTitle} за ${byDays ? 'день' : 'неделю'} ${title}`);
                let addData = (name, title, color) => {
                    let num = resultMax[name] && (parseInt(resultMax[name]) || resultMax[name].toFixed(1)) || 0;
                    if (percentage) title += ` (100% - ${num})`;
                    bar.addData(resultInfo[name], title, color)
                };
                addData('countSymbols', 'Символы (сотни)', '12127D');
                addData('countMessages', 'Сообщения', '0066B3');
                addData('countStickers', 'Стикеры', 'FFCE00');
                addData('countForwards', 'Пересылаемые сообщения', '00B060');
                addData('countAttachments', 'Прикрепления', 'DE0052');
                addData('countAudio', 'Голосовые сообщения', '7E07A9');
                addData('countCommands', 'Команды бота', 'ABF000');
                if (byDays) {
                    let axisLabels = new Array(24).fill(0);
                    axisLabels = axisLabels.map((el, n) => n + 1).map(n => n > 9 ? n : '0'+n);
                    bar.addAxisLabels('x', axisLabels);
                } else {
                    bar.addAxisLabels('x', ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресение']);
                }

                let chartUrl = bar.getUrl(true); // First param controls http vs. https
                chartUrl += '&.png';
                resolve(message.sendPhoto({
                    value: chartUrl,
                    options: {
                        contentType: 'image/png'
                    }
                }));
            });
        }));
    }




};


