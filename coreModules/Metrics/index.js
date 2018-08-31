'use strict';

const CoreModuleEventController = require('../../classes/base/CoreModuleEventController');
const ModuleEventController = require('../../classes/base/ModuleEventController');
const promiseFactory = require('../../helpers/promiseFactory');
const ChatHourStatistics = require('./ChatHourStatistics');
// const pmxCores = require('pmx-cores');
const pmx = require('pmx');
const probe = pmx.probe();
// const loadAvg = require('loadavg');

module.exports = class Metrics extends CoreModuleEventController {

    constructor() {
        super();
        this.startTime = Date.now();
    }

    /**
     *
     * @return {Specification}
     */
    moduleSpecification() {
        return {
            commandList: {
                name: 'Метрики',
            },
            commands: [
                {
                    name: 'showStatus',
                    check: {
                        args: 'статус',
                        admin: true,
                    },
                    commandList: {
                        name: 'статус',
                        description: 'показывает информацию о работе бота',
                    },
                    messageTemplate: {
                        title: 'статус в #{0}:#{1}',
                        body: '#{0}: #{1}',
                    },
                    web: {
                        output: 'статус',
                        reload: 6e4,
                    }
                },
                {
                    name: 'showCommandStat',
                    check: {
                        args: /^стат команд(?: (\d+)( час[а-я]*)?(?: - ?(\d+))?)?(?:(?: чат (\S+))|(?: диалог (\S+)))?(?: юзер (\S+))?(?: модуль (\S+))?(?: команда (\S+))?(?: груп (\S+))?(?: сорт (\S+))?$/i,
                        admin: true,
                    },
                    commandList: {
                        name: 'стат команд',
                        usage: 'стат команд {количество дней}',
                        description: `стат команд {количество дней или часов} {"час"} {"-" количество дней или часов} {"диалог (номер или название)"} {"чат (номер или название)"} {"юзер (номер или имя {+ фамилия через тире})} {"модуль (название)"} {"команда (название)"} {"груп ('чат' или 'юзер' или 'модуль' или 'команда' или 'день' или 'час')"} {"сорт (команды)"}`
                    },
                    messageTemplate: {
                        emptyFail: 'по вашему запросу ничего не найдено',
                        title: 'Статистика по командам#{0}:',
                        body: '#{0}:\n - всего: #{1}, с ошибкой: #{2}',
                    },
                }
            ]
        }
    }

    _init(bot) {
        /**
         *
         * @type {Object<String, { model: ChatHourStatistics, pendingModels: Array<ChatHourStatistics> }>}
         */
        this.commandsInfo = {};
        this.savePromise = Promise.resolve();
        this.metric = {};
        this.metric.uptime = {
            name: 'Время работы (мин.)',
            val: () => Math.ceil((Date.now() - this.startTime)/6e4),
        };
        this.metric.ChatsCounter = probe.counter({
            name : 'Chats'
        });
        this.metric.ChatsCounter.name = 'Чатов';
        this.metric.DialogsCounter = probe.counter({
            name : 'Dialogs'
        });
        this.metric.DialogsCounter.name = 'Диалогов';
        this.metric.AllCommandsCounter = probe.counter({
            name : 'All commands count'
        });
        this.metric.AllCommandsCounter.name = 'Команд выполнено';
        this.metric.FailCommandsCounter = probe.counter({
            name : 'Fail commands count'
        });
        this.metric.FailCommandsCounter.name = 'Команд с ошибкой';
        this.metric.RunningCommandsCounter = probe.counter({
            name : 'Running commands'
        });
        this.metric.RunningCommandsCounter.name = 'Команд выполняется';
        // this.metric.AllMessagesCounter = probe.counter({
        //     name : 'All messages count'
        // });
        // this.metric.AllMessagesCounter.name = 'Сообщений всего';
        probe.metric({
            name    : 'longpoll',
            value   : () => bot.vk.longpoll.isStarted(),
        });

        let samples = 15;
        this.intervals = [1, 15];
        this.intervals.forEach(min => {
            this.metric[`MessagesPerMin${min}`] = probe.meter({
                name: `Messages per min (last ${min} min)`,
                samples: 60,
                timeframe: 60 * min,
            });
            this.metric[`MessagesPerMin${min}`].name = `Сообщений/мин (за ${min} мин.)`;
        });
        this.intervals.forEach(min => {
            this.metric[`CommandsPerMin${min}`] = probe.meter({
                name: `Commands per min (last ${min} min)`,
                samples: 60,
                timeframe: 60 * min,
            });
            this.metric[`CommandsPerMin${min}`].name = `Команд/мин (за ${min} мин.)`;
        });
        this.intervals.forEach(min => {
            this.metric[`MemoryPerMin${min}`] = probe.meter({
                name: `Memory usage avg (last ${min} min)`,
                samples,
                timeframe: 60 * min,
            });
            this.metric[`MemoryPerMin${min}`].name = `Сред. память (МБ) (за ${min} мин.)`;
        });
        this.memoryInterval = setInterval(() => {
            let mem = process.memoryUsage().rss / (1024*1024);
            this.intervals.forEach(min => {
                this.metric[`MemoryPerMin${min}`].mark(Math.round(mem));
            })
        }, samples*1e3);

        // this.sendInfo = setInterval(() => {
        //     let command = this.specification.commands.slice().filter(el => el.name === 'showStatus')[0];
        //     this.showStatus(null, new this.bot.Message({peer: this.bot.selfId}), command);
        // }, 6e4);
        return super._init(bot)
            .then(() => promiseFactory.allAsync([
                CoreModuleEventController.global.on(this.eventNames.runCommand, this._onRunCommand, this),
                CoreModuleEventController.global.after(this.eventNames.runCommand, this._afterRunCommand, this),
                ModuleEventController.global.on(this.eventNames.runCommand, this._onRunCommand, this),
                ModuleEventController.global.after(this.eventNames.runCommand, this._afterRunCommand, this),
                this.bot.on(this.bot.eventNames.message, this._onMessage, this),
                this.bot.Chat.global.after(this.bot.Chat.eventNames.init, chat => {
                    if (chat.type === 'chat')
                        this.metric.ChatsCounter.inc();
                    else this.metric.DialogsCounter.inc();
                }, this),
            ]))
    }

    _final() {
        return super._final()
            .then(() => promiseFactory.allAsync([
                CoreModuleEventController.global.removeListenersOnByHandler(this.eventNames.runCommand, this),
                CoreModuleEventController.global.removeListenersAfterByHandler(this.eventNames.runCommand, this),
                ModuleEventController.global.removeListenersOnByHandler(this.eventNames.runCommand, this),
                ModuleEventController.global.removeListenersAfterByHandler(this.eventNames.runCommand, this),
                this.bot.removeListenersOnByHandler(this.bot.eventNames.message, this),
                this.bot.Chat.global.removeListenersAfterByHandler(this.bot.Chat.eventNames.init, this),
            ]))
    }

    /**
     *
     * @return {Promise.<*>}
     */
    stop() {
        let promises = [];
        for (let id of Object.keys(this.commandsInfo)) {
            let result = Promise.resolve();
            for (let model of this.commandsInfo[id].pendingModels) {
                result = result.then(() => {
                    return this.commandsInfo[id].model.inc(model)
                        .then(newModel => this.commandsInfo[id].model = newModel);
                })
            }
            promises.push(result.then(() => this.commandsInfo[id].model.saveOrUpdate()));
        }
        return promiseFactory.allAsync(promises);
    }

    _getCommandId(chatId, userId, moduleName, commandName) {
        let id = '' + chatId + userId + moduleName + commandName;
        if (!this.commandsInfo[id]) {
            let model = new ChatHourStatistics({
                chatId,
                userId,
                moduleName,
                commandName,
            });
            model.fullDate = new Date();
            this.commandsInfo[id] = {
                model,
                pendingModels: [],
            }
        }
        return id;
    }

    _onRunCommand(chat, message, command, module) {
        this.metric.RunningCommandsCounter.inc();
        let id = this._getCommandId(chat.id, message.user, module.specification.name, command.name);
        let chatInfo = new ChatHourStatistics({
            chatId: chat.id,
            userId: message.user,
            moduleName: module.specification.name,
            commandName: command.name,
        });
        chatInfo.fullDate = new Date();
        this.commandsInfo[id].pendingModels.push(chatInfo);
    }

    _afterRunCommand(chat, message, command, module, result) {
        this.metric.AllCommandsCounter.inc();
        if (result === null)
            this.metric.FailCommandsCounter.inc();
        this.metric.RunningCommandsCounter.dec();
        this.intervals.forEach(min => {
            this.metric[`CommandsPerMin${min}`].mark();
        });
        let id = this._getCommandId(chat.id, message.user, module.specification.name, command.name);
        let chatInfo = this.commandsInfo[id].pendingModels.pop();
        chatInfo.setInfo(Date.now() - chatInfo.date.time, result === null);
        return this.commandsInfo[id].model.inc(chatInfo).then(newModel => this.commandsInfo[id].model = newModel);
    }

    _onMessage() {
        // this.metric.AllMessagesCounter.inc();
        this.intervals.forEach(min => {
            this.metric[`MessagesPerMin${min}`].mark();
        })
    }

    /**
     *
     * @param {Chat|*} [chat]
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showStatus(chat, message, command) {
        let info = Object.keys(this.metric).map(id => this.metric[id]);
        return message.setTitleTemplate(command.messageTemplate.title, new Date().getHours(), new Date().getMinutes())
            .setBodyTemplate(command.messageTemplate.body, n => info[n].name, n => info[n].val())
            .setTemplateLength(info.length)
            .send();
    }

    /**
     *
     * @param {Chat|*} [chat]
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showCommandStat(chat, message, command) {
        let info = command.check.args.exec(message.getCommandText());
        let period = +info[1];
        let dateMultiplierHours = info[2];
        let periodTo = +info[3] || 0;
        let dateMultiplier = dateMultiplierHours ? 1 : 24;
        let toMsMultiplier = 60 * 60 * 1000 * dateMultiplier;
        let chatIdOrName = info[4] || info[5];
        let chatType = info[4] ? 'chat' : 'dm';
        let chatId;
        let userIdOrName = info[6] && info[6].replace('-', ' ');
        let userId;
        let moduleIdOrName = info[7] && info[7].replace('-', ' ');
        let moduleName;
        let commandIdOrName = info[8] && info[8].replace('-', ' ');
        let commandName;
        let groupBy = info[9];
        let sortBy = info[10];

        let query = ChatHourStatistics.find();
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
        if (moduleIdOrName || commandIdOrName) {
            let modRegExp = new RegExp(moduleIdOrName, 'i');
            let comRegExp = new RegExp(commandIdOrName, 'i');
            for (let module of this.bot.modules.concat(this.bot.coreModules)) {
                if (moduleName && (!commandIdOrName || commandName)) continue;
                let spec = module.specification;
                if (!moduleName && moduleIdOrName && (spec.commandList && spec.commandList.name
                    && modRegExp.test(spec.commandList.name) || modRegExp.test(spec.name))) {
                    moduleName = spec.name;
                    moduleIdOrName = spec.commandList && spec.commandList.name || spec.name;
                }
                if (commandIdOrName && !commandName) {
                    for (let command of spec.commands) {
                        if (!commandName && (command.commandList && command.commandList.name
                            && comRegExp.test(command.commandList.name)
                            || command.name && comRegExp.test(command.name))) {
                            commandName = command.name;
                            commandIdOrName = command.commandList && command.commandList.name || commandName;
                        }
                    }
                }
            }
        }
        // set query
        if (chatId) query = query.where({ chatId });
        if (userId) query = query.where({ userId });
        if (period) {
            let dateFrom = new Date(Date.now() - (period + periodTo) * toMsMultiplier);
            let dateTo = new Date(Date.now() - periodTo * toMsMultiplier);
            if (!dateMultiplierHours) {
                dateFrom.setHours(23);
                dateTo.setHours(23);
            }
            dateFrom.setMinutes(59, 59, 999);
            dateTo.setMinutes(60);
            query = query.betweenDates(dateFrom, dateTo);
        }
        if (moduleName) query = query.where({ moduleName });
        if (commandName) {
            query = query.where({ commandName });
            groupBy = groupBy || 'день';
        }
        // utils
        let sort = (docs, key, direct = 1) => {
            docs.sort((a, b) => {
                if (typeof a[key] === 'number') return direct * (a[key] - b[key]);
                if (typeof a[key] === 'string') {
                    let result = 0;
                    for (let i = 0; i < Math.max(a[key].length, b[key].length); i++) {
                        result += direct * ((a[key].charCodeAt(i) || 0) - (b[key].charCodeAt(i) || 0));
                        if (result) return result;
                    }
                }
            })
        };
        let group = (docs, resultDocs, key, func) => {
            sort(docs, key);
            resultDocs.push(docs.shift());
            docs.forEach(doc => {
                if (doc[key] === resultDocs[resultDocs.length-1][key]) {
                    resultDocs[resultDocs.length-1].sumUp(doc);
                } else {
                    resultDocs.push(doc);
                }
            });
        };
        // find docs
        return query.find().exec().then(docs => {
            let cacheInfo = Object.keys(this.commandsInfo).map(id => this.commandsInfo[id].model)
                .filter(doc => {
                    return (
                         !(chatId && doc.chatId !== chatId)
                        && !(userId && doc.userId !== userId)
                        && !(period && doc.period !== period)
                        && !(moduleName && doc.moduleName !== moduleName)
                        && !(commandName && doc.commandName !== commandName)
                        && !(period && doc.date.time < Date.now() - period * toMsMultiplier)
                    );
                });

            docs = docs.concat(cacheInfo);
            if (!docs.length) {
                return message.setTitle(command.messageTemplate.emptyFail).createReply().send();
            }
            let resultDocs = [];
            let tempFun;

            // group
            if ('чат'.includes(groupBy)) {
                group(docs, resultDocs, 'chatId');
                resultDocs.forEach(doc => {
                    if (this.bot.chats[doc.chatId]) {
                        if (this.bot.chats[doc.chatId].type === 'chat') {
                            doc._doc.chatId = `(#${doc.chatId-2e9}) ${this.bot.chats[doc.chatId].title}`;
                        } else {
                            doc._doc.chatId = `(#${doc.chatId}) ${this.bot.chats[doc.chatId].name} ${this.bot.chats[doc.chatId].secondName}`;
                        }
                    }
                });
                tempFun = n => `чат ${resultDocs[n].chatId}`;
            } else if ('юзер'.includes(groupBy)) {
                group(docs, resultDocs, 'userId');
                for (let id of Object.keys(this.bot.chats)) {
                    resultDocs.forEach(doc => {
                        if (this.bot.chats[id].users.includes(doc.userId)) {
                            let user = this.bot.chats[id].userNames[doc.userId];
                            doc._doc.userId = `${user.name} ${user.secondName}`;
                        }
                    });
                }
                tempFun = n => resultDocs[n].userId;
            } else if ('модуль'.includes(groupBy)) {
                group(docs, resultDocs, 'moduleName');
                for (let module of this.bot.modules.concat(this.bot.coreModules)) {
                    let spec = module.specification;
                    resultDocs.forEach(doc => {
                        if (spec.name === doc.moduleName && spec.commandList && spec.commandList.name) {
                            doc.moduleName = spec.commandList.name;
                        }
                    })
                }
                tempFun = n => `модуль ${resultDocs[n].moduleName}`;
            }  else if ('день'.includes(groupBy) || 'час'.includes(groupBy)) {
                let equalFuncName = 'день'.includes(groupBy) ? 'equalDay' : 'equalDate';
                docs.sort((a, b) => b.date.time - a.date.time);
                resultDocs.push(docs.shift());
                docs.forEach(doc => {
                    if (resultDocs[resultDocs.length-1][equalFuncName](doc.fullDate)) {
                        resultDocs[resultDocs.length-1].sumUp(doc);
                    } else resultDocs.push(doc);
                });
                let nf = n => (n > 9 && n || `0${n}`);
                tempFun = n => {
                    let text = `${nf(resultDocs[n].date.day)}.${nf(resultDocs[n].date.month+1)}.${nf(resultDocs[n].date.year)}`;
                    if ('час'.includes(groupBy)) text += ` в ${nf(resultDocs[n].date.hours)}`;
                    return text;
                };
            } else { // default by command
                sort(resultDocs, 'moduleName');
                group(docs, resultDocs, 'commandName');
                for (let module of this.bot.modules.concat(this.bot.coreModules)) {
                    let spec = module.specification;
                    resultDocs.forEach(doc => {
                        if (spec.name === doc.moduleName && spec.commandList && spec.commandList.name) {
                            doc.moduleName = spec.commandList.name;
                        }
                        for (let command of spec.commands) {
                            if (command.name === doc.commandName && command.commandList && command.commandList.name) {
                                doc.commandName = command.commandList.name;
                            }
                        }
                    });
                }
                tempFun = n => `команда ${resultDocs[n].commandName} (${resultDocs[n].moduleName})`;
            }

            // sort
            if ('команды'.includes(sortBy)) {
                sort(resultDocs, 'allCount', -1);
            }

            resultDocs = resultDocs.filter(doc => doc.allCount + doc.failCount > 0);

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
            if (moduleName) title += ` модуля '${moduleIdOrName}'`;
            if (commandName) title += ` команды '${commandIdOrName}'`;


            let paginationNumInPage = 50;
            let sendFun = end => {
                return message.new.setTitleTemplate(command.messageTemplate.title, title)
                    .setBodyTemplate(command.messageTemplate.body, tempFun,
                        n => resultDocs[n].allCount, n => resultDocs[n].failCount)
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
                return chat.on(chat.eventNames.message, onMessage, this).then(next);
            } else return sendFun();
        })
    }

};