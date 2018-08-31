'use strict';

const ModuleEventController = require('../../classes/base/ModuleEventController');
const UserStatistics = require('../../classes/db/UserStatistics');
const UserHourStatistics = require('../../classes/db/UserHourStatistics');
const GameChatInfo = require('./GameChatInfo');
const GameUserInfo = require('./GameUserInfo');
const GameDuelInfo = require('./GameDuelInfo');
const GameRandomDuelInfo = require('./GameRandomDuelInfo');
const Message = require('../../classes/core/Message');
const promiseFactory = require('../../helpers/promiseFactory');

module.exports = class Game extends ModuleEventController {

    /**
     * @typedef {Object} GameUserInfo
     * @property {Number} chatId
     * @property {Number} userId
     * @property {String} name
     * @property {Number} gold
     * @property {Number} state
     * @property {Number} active
     * @property {Number} lastActive
     * @property {Number} activePower
     * @property {Number} equipmentPower
     * @property {Number} lvlPower
     * @property {Number} fullPower
     * @property {Number} duelsWin
     * @property {Number} duelsLoose
     * @property {Number} rating
     * @property {Number} lvl
     * @property {Number} exp
     * @property {{ name: String, power: Number }} helmet
     * @property {{ name: String, power: Number }} armor
     * @property {{ name: String, power: Number }} weapon
     */

    /**
     *
     * @param config
     */
    constructor({
                    config = {},
                } = {}) {
        super();
        this.config = {
            userStateFromHours: 3,
            userStateByHours: 24,
            auctionDuration: 3,
            salaryByUser: 13,
            duelCost: 25,
            maxEquipmentPower: 35,
            defaultUserState: 60,
            activePowerRatio: 0.75,
            lvlPowerRatio: 0.75,
            maxPowerLuck: 0.15,
            salaryPeriod: 36e5,
            auctionPeriod: 36e5,
            duelPeriod: 36e5,
            randomDuelPeriod: 36e5,
            chatDuelPeriod: 36e5,
            // salaryPeriod: 0,
            // auctionPeriod: 0,
            // duelPeriod: 0,
            // randomDuelPeriod: 0,
            // chatDuelPeriod: 0,
            maxRateRandomDuelPerLvl: 4,
            maxRateChatDuelPerLvl: 10,
            expFromDuel: 6,
            expToLevel: 30,
            chatDuelUserCountRatio: 1,
            chatDuelLooserGoldRatio: 0.6,
            salaryFromChatLvlRatio: 0.06,
            equipmentScatter: 0.2,
            auctionMaxCostByPower: 1000,
            auctionEquipmentByChatLvl: 0.07,
            auctionMaxEquipmentCount: 15,
            chatsTopCount: 15,
            usersTopCount: 15,
        };
        Object.assign(this.config, config);
    }

    /**
     * @returns {Specification}
     */
    moduleSpecification() {
        return {
            type: 'chat',
            commandList: {
                name: 'Игра',
                description: 'Добавляет элементы игры в чат - покупайте предметы для своего персонажа, учавствуйте в дуэлях и битвах гильдий, чем вы активнее в чате - тем сильнее будете!',
            },
            web: {
                icon: {
                    name: 'MdVideogameAsset',
                    options: {
                        color: '#9e1208',
                    }
                },
            },
            messageTemplate: {
                duelFinals: [
                    'после долгой схватки, #{0}, используя #{2} добивает персонажа #{1} ударом в #{3}!\n🏆 #{4} победитель!',
                ],
                userInfoEnd: 'сила снаряжения: 💪 #{0}\n' +
                '📊 сила актива: 💪 #{1}\n' +
                '🎓 сила уровня: 💪 #{2}\n' +
                '🔆 сила удачи: 💪 #{3}\n' +
                '🤺 суммарная сила: 💪 #{4}',
                duelInfo: 'информация о персонажах дуэли:\n#{0}\n#{1}',
                userInfoSmall: 'информация об игровом персонаже #{0}:\n' +
                'состояние: #{1} (#{2}%)\n' +
                'уровень: #{4}',
            },
            commands: [
                {
                    name: 'help',
                    check: {
                        args: /^игра помощь$/i
                    },
                    commandList: {
                        name: 'помощь по игре',
                        usage: 'игра помощь',
                    },
                    messageTemplate: {
                        title:
`У кaждoго учaстникa чатa ecть свoй игрoвoй перcонаж, имеющий: оснoвную xаpактeристику - силу (💪), голду (💰), уровень (🎓) (зaвисит oт oпытa EXP) и cнaряжение (шлем (⛑), брoня (🛡) и oружие (⚔)), кoтopoe увeличивaeт силу перcонaжа и покупаeтcя нa aукциoне. Ранг персонажа определяется количеством побед / поражений в обычных и рандом дуэлях.
Также у пеpсoнажа eсть сoстoяниe (в %) - oно oпpедeляется отнoсительно текущeгo и дневнoгo aктива учaстника в чатe.

Аукцион - это то место, где выcтaвляетcя cлучaйное снaряжение со случайными xаpактepиcтиками (чeм вышe xaрaктepистики, тeм режe выпaдaет). Максимальная сила одной вещи составляет ${this.config.maxEquipmentPower} единиц. Аукцион можно прoводить не чaще, чем рaз в чaс. На аукцион можно вложить голду из казны гильдии, для увеличения минимальной силы предлагаемого снаряжения (максимально - ${this._getMaxAuctionCost()} 💰).

У каждoгo чатa eсть гильдия, у котоpой имeeтся урoвень (🎓) - опpeделяeтся кaк сpeднеe oт всеx уpoвней учacтников. Казна (💰) - пoполнять eе можнo учaвcтвуя в битвax гильдий, и ранг(oпpедeляетcя кoличeствoм побед / пpоигрышей гильдии). Зa кaждый бой гильдий вы пoлучаете голду, которая уходит в казну, незaвиcимo oт тогo проигрaли ли вы или выиграли (выигpывaя получaешь больше) а так же опыт, который выдается всем активным участникам(тот кто был активен в чате ). Пoлучaeмый опыт так жe завиcит от paзницы в cиле как и в обычных дуэлях. От уровня зависит то, сколько вы сможете поставить на доп. ставку, то есть чeм бoльшe уровeнь гильдии тем бoльше вы мoжете пocтaвить голды нa допoлнитeльную стaвку.

Рaз в чac вceм пеpcонажaм чaта можнo выдaвaть жaлование из казны гильдии - общая cуммa для чaта зависит от кoличеcтвa активных в пoслeднeе вpемя учаcтников, а количecтвo жaлования на каждoгo пepcoнaжа - в зaвисимоcти oт поcлeднегo aктивa участников oтнoситeльно oбщeго, кoличecтво жалования зaвиcит oт уpoвня гильдии.

Пeрcoнaжи мoгут вызывать друг друга на дуэли (каждый персонаж мoжeт вызвaть пpoвoдить дуэль раз в час).
На дуэли cpaвнивaетcя oбщая силa участников, кoторaя являeтcя cуммoй:
1) всeгo cнаpяжения учаcтникa
2) cилы aктивa, oпpеделеннoй из послeднeго активa учacтникa и сocтояния пеpcонажa
3) уровня (зависит oт oпытa) - чeм большe уpовeнь, тем больше cила уpовня
4) удачи, кaждый pаз oпрeдeляeтся cлучaйным обpазoм, но нe бoльше 15% oт общей cилы
тoт, у кoгo итоговaя силa большe, победил!
Тaкже pаз в чаc пepсoнаж может устраивaть рaндом дуэль, делая необязательную ставку и вызывaя случaйного перcонажa случайной другой гильдии на дуэль, ecли выигpываeт - получает голду, рaвную стaвке, инaче теpяет стoлькo жe голды(а также рандомные дуэли - дуэль со случайным персонажем из случайной гильдии(можно использовать раз в час, но счетчик времени независим от счетчика времени обычной дуэли).

Опыт, нужный для уpовня, мoжнo пoлучить учаcтвуя в дуэлях, чем больше pазницa в cиле прoтивникoв, тем больше пoлучит cлабейший и тeм мeньше пoлучит cильнейший. Опыт повышаeт уpовень вашего пеpcoнажa, a уpовень в слeдующую oчepедь пoвышаeт лимит мaксимaльнoй cтaвки в "рандoм дуэли" a тaкжe дaeт вам дoпoлнитeльную силу.`,
                    },
                    execute: (chat, message, command) => message.setTitle(command.messageTemplate.title).send(),
                    web: {},
                },
                {
                    name: 'showChat',
                    check: {
                        args: /^гильдия/i,
                    },
                    commandList: {
                        name: 'гильдия',
                        description: 'показывает информацию о гильдии чата',
                    },
                    vip: {
                        usages: 10,
                    },
                    messageTemplate: {
                        title: 'гильдия "#{0}":\n' +
                        '(сила и уровень определяются как среднее от всех персонажей)\n' +
                        'сила: 💪 #{1}\n' +
                        'уровень: 🎓 #{2}\n' +
                        'казна: 💰 #{3}\n' +
                        'ранг: &#128285; #{4}',
                    },
                    web: {},
                },
                {
                    name: 'showUsers',
                    check: {
                        args: /^персонажи/i,
                    },
                    commandList: {
                        name: 'персонажи',
                        description: 'показывает персонажей текущей гильдии',
                    },
                    vip: {
                        usages: 10,
                    },
                    messageTemplate: {
                        title: 'персонажи гильдии "#{0}":\n' +
                        '(🔸 активен или 💤 нет, 💪  суммарная постоянная сила, 💰 голда, 🎓 уровень, &#128285; очки рейтинга, состояние)',
                        body: '#{0}:\n #{1} | 💪 #{2} | 💰 #{3} | 🎓 #{4} | &#128285; #{5} | #{6} (#{7}%)',
                        activeText: '🔸',
                        notActiveText: '💤',
                    },
                    web: {},
                },
                {
                    name: 'userInfo',
                    check: {
                        args: /^персонаж(?: ([a-zа-яё]+? ?[a-zа-яё]*?|\d{4,}))?$/i
                    },
                    commandList: {
                        name: 'информация о персонаже',
                        usage: 'персонаж (имя)',
                        description: 'показывает информацию об игровом персонаже',
                    },
                    vip: {
                        usages: 20,
                    },
                    messageTemplate: {
                        title: 'информация об игровом персонаже #{0}:\n' +
                        'состояние: #{1} (#{2}%)\n' +
                        'голда: 💰 #{3}\n' +
                        'уровень: 🎓 #{4}\n' +
                        'опыт: #{5} / #{6} EXP\n' +
                        'ранг: &#128285; #{7}\n' +
                        'снаряжение:',
                        body: '• #{0}: #{1} #{2} (💪 #{3})',
                        end: 'дуэль: #{0}\nрандом дуэль: #{1}',
                    },
                    web: {
                        filter: (props, chat, message) => ({
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
                        }),
                        output: props => `персонаж ${props && props.user}`,
                    }
                },
                {
                    name: 'duel',
                    check: {
                        args: /^дуэль ([a-zа-яё]+? ?[a-zа-яё]*?|\d{4,})$/i,
                    },
                    vip: {
                        usages: 7,
                    },
                    commandList: {
                        name: 'дуэль',
                        usage: 'дуэль (имя участника)',
                        description: 'вызывает другого персонажа на дуэль',
                    },
                    messageTemplate: {
                        startDuel: '#{1}, готовы ли вы вступить в дуэль с #{0}? (напишите "готов", чтобы начать дуэль)',
                        failUser: 'персонаж с именем #{0} не найден!',
                        failTimeout: '#{0}, похоже #{1} не захотел биться с вами!',
                        failRequest: '#{0}, у вас уже есть запрос на дуэль!',
                        failPeriod: '#{0}, вы уже вызывали кого-то на дуэль в этом часу! (осталось #{1} мин.)',
                        end: '\n#{0} получает за победу &#128285; #{1} ранга и #{2} опыта, #{3} теряет за поражение &#128285; #{4} ранга и получает #{5} опыта',
                    },
                },
                {
                    name: 'randomDuel',
                    check: {
                        args: /^рандом дуэль(?: (\d+))?$/i,
                    },
                    vip: {
                        usages: 7,
                    },
                    commandList: {
                        name: 'рандом дуэль',
                        usage: 'рандом дуэль {ставка голды}',
                        description: 'вызывает случайного персонажа на дуэль',
                    },
                    messageTemplate: {
                        failRate: 'для вашего уровня персонажа (🎓 #{0}) ставка не может быть больше #{1} 💰',
                        failGold: 'недостаточно голды для такой ставки (у вас есть #{0} 💰)',
                        failPeriod: '#{0}, вы уже вызывали кого-то на рандом дуэль в этом часу! (осталось #{1} мин.)',
                        failChat: 'не удалось найти соперника для рандом дуэли, попробуйте позже',
                        endWinner: '\n#{0} получает за победу над случайным противником ([id#{1}|#{2}]) #{3} голды, &#128285; #{4} ранга и #{5} опыта',
                        endLooser: '\n#{0} теряет за поражение от случайного противника ([id#{1}|#{2}]) #{3} голды, &#128285; #{4} ранга и получает #{5} опыта',
                        failAuction: 'нельзя запускать рандом дуэль во время аукциона!',
                    },
                },
                {
                    name: 'chatsDuel',
                    check: {
                        args: /^битва гильдий(?: (\d+))?/i,
                    },
                    commandList: {
                        name: 'битва гильдий',
                        usage: 'битва гильдий {дополнительная ставка голды}',
                    },
                    vip: {
                        usages: 3,
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        failRate: 'в казне гильдии недостаточно голды для такой дополнительной ставки (в казне #{0} 💰)',
                        failRateLvl: 'для уровня вашей гильдии (🎓 #{0}) ставка не может быть больше #{1} 💰',
                        failPeriod: 'битва гильдий уже проводилась в этом часу! (осталось #{0} мин.)',
                        failChat: 'не удалось найти соперника для битвы гильдий, попробуйте позже',
                        failAuction: 'нельзя устраивать битву гильдий во время аукциона!',
                        title: 'информация о гильдиях битвы:\n' +
                        'ваша гильдия "#{0}" (##{1}):\n' +
                        '- средняя сила активных персонажей: 💪 #{2}\n' +
                        '- надбавка за количество активных персонажей: 💪 #{3}\n' +
                        '- ранг: &#128285; #{4}\n' +
                        '\nгильдия противников "#{5}" (##{6}):\n' +
                        '- средняя сила активных персонажей: 💪 #{7}\n' +
                        '- надбавка за количество активных персонажей: 💪 #{8}\n' +
                        '- ранг: &#128285; #{9}\n',
                        endWin: 'ваша гильдия побеждает, и получает #{0} 💰 за победу и #{1} 💰 за дополнительную ставку, а также все активные персонажи получают #{2} опыта',
                        endLoose: 'ваша гильдия проигрывает, получает поощрительные #{0} 💰 за участие и теряет #{1} 💰 за дополнительную ставку, а также все активные персонажи получают #{2} опыта',
                    },
                },
                {
                    name: 'chatsTop',
                    check: {
                        args: 'топ гильдий',
                    },
                    commandList: {
                        name: 'топ гильдий',
                        description: 'показывает топ гильдий по рангу',
                    },
                    messageTemplate: {
                        title: 'топ гильдий по рангу:',
                        body: '#{0}. "#{1}" (##{2}) - ранг &#128285; #{3}',
                        end: '...\n#{0}. "#{1}" (#{2}) - ранг &#128285; #{3}',
                    }
                },
                {
                    name: 'usersTop',
                    check: {
                        args: 'топ персонажей',
                    },
                    commandList: {
                        name: 'топ персонажей',
                        description: 'показывает топ персонажей по рангу',
                    },
                    messageTemplate: {
                        title: 'топ персонажей по рангу:',
                        body: '#{0}. [id#{1}|#{2}] - ранг &#128285; #{3}',
                        end: '...\n#{0}. [id#{1}|#{2}] - ранг &#128285; #{3}',
                    },
                },
                {
                    name: 'getSalary',
                    check: {
                        args: /^выдать жалование/i,
                    },
                    commandList: {
                        name: 'выдать жалование',
                        description: 'выдает жалование (голду) активным в последнее время участникам чата из казны гильдии',
                    },
                    vip: {
                        usages: 4,
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'между участниками чата поделено жалование голды из казны по их активности (всего #{0} 💰, в казне осталось #{1} 💰):\n' +
                        '(выдано / всего)',
                        body: '#{0}: +#{1} 💰 / #{2} 💰',
                        titleFail: 'жалование уже выдавалось в этом часу! (осталось #{0} мин.)',
                        failGold: 'нечего выдавать, казна гильдии пуста! чтобы увеличить казну, участвуйте в битвах гильдий (команда "битва гильдий")',
                        failAuction: 'нельзя выдавать жалование во время аукциона!',
                    },
                    // web: {
                    //     type: "action",
                    //     submitText: 'выдать жалование',
                    //     changes: {
                    //         module: this.constructor.name,
                    //         command: [
                    //             'userInfo',
                    //             'showUsers',
                    //         ],
                    //     },
                    // }
                },
                {
                    name: 'startAuction',
                    check: {
                        args: /^начать аукцион(?: (\d+))?$/i,
                    },
                    commandList: {
                        name: 'начать аукцион',
                        usage: 'начать аукцион {вложение голды из казны}',
                        description: `начинает аукцион, на котором все участники чата могут посоревноваться за покупку снаряжения для своих персонажей, (можно вложить голду из казны гильдии на проведение аукциона, чтобы увеличить минимальную силу предлагаемого снаряжения, максимум - ${this._getMaxAuctionCost()} 💰)`,
                    },
                    vip: {
                        usages: 3,
                    },
                    commandAccess: {
                        defaultStatus: 9,
                    },
                    messageTemplate: {
                        title: 'аукцион начинается! чтобы сделать ставку, пишите "ставка (номер лота) (голда)", например - "ставка 1 50" \n' +
                        'ставка должна быть не меньше начальной\n' +
                        'каждый участник может делать сколько угодно ставок, но учитывается только самая последняя, на которую у него хватает голды\n' +
                        `купленные предметы заменяют старые, длительность аукциона - ${this.config.auctionDuration} мин.\n` +
                        'в аукцион вложено #{0} 💰 из казны гильдии для увеличения минимальной силы предлагаемого снаряжения' +
                        '\nсписок лотов:',
                        titleDuration: 'аукцион уже идет, список лотов:\n#{0}\n\nтекущие ставки:',
                        durationEmpty: 'ставок пока нет',
                        body: 'лот №#{0}: #{1} #{2} (💪 #{3}) - #{4} 💰 (начальная ставка)',
                        end: '\nпоехали!',
                        finalTitle: 'аукцион закрыт, итоги:',
                        finalBody: '#{0} получает #{1} #{2} (💪 #{3}) за #{4} 💰',
                        finalInfoEmpty: 'аукцион заканчивается через минуту, ставок пока нет',
                        finalInfoTitle: 'аукцион заканчивается через минуту, текущие ставки:',
                        finalInfoBody: '#{0}: лот - #{1}, ставка - #{2} 💰',
                        failEmpty: 'на аукционе ничего не куплено',
                        failPeriod: 'аукцион уже проводился в этом часу! (осталось #{0} мин.)',
                        failDuration: 'аукцион уже идет!',
                        failRate: 'в казне гильдии недостаточно голды для такого вложения в аукцион (в казне #{0} 💰)',
                    },
                },
                {
                    name: 'timers',
                    check: {
                        args: 'игра откаты',
                    },
                    commandList: {
                        name: 'игра откаты',
                        description: 'показывает, когда снова можно устраивать дуэли, рандом дуэли и битву гильдий',
                    },
                    messageTemplate: {
                        title: 'откаты игры в этой гильдии:\n' +
                        'аукцион доступен через: #{0} мин.\n' +
                        'битва гильдий доступна через: #{1} мин.\n' +
                        'выдача жалования доступна через: #{2} мин.\n\n' +
                        'откаты персонажей (дуэль | рандом дуэль):',
                        body: '#{0}: #{1} | #{2}',
                    },
                    web: {},
                },
            ]
        };
    }

    _init(bot) {
        this.chatAuction = {};
        this.salary = {};
        this.chatDuels = {};
        return super._init(bot);
    }

    /**
     *
     * @return {Array<String>}
     */
    get equipmentNames() {
        return Object.keys(this.equipmentInfo);
    }

    /**
     *
     * @return {{helmet: {label: string, names: Array<String>, icon:
     *     string}, armor: {label: string, names: Array<String>, icon:
     *     string}, weapon: {label: string, names: Array<String>, icon:
     *     string}}}
     */
    get equipmentInfo() {
        return {
            helmet: {
                label: 'шлем',
                names: ['шлем', 'каска', 'шляпа', 'шлемофон', 'мисюрка', 'шлемак', 'убор', 'панамка'],
                icon: '⛑',
                type: 'helmet',
            },
            armor: {
                label: 'броня',
                names: ['броня', 'латы', 'панцирь', 'бронь', 'одежка', 'доспехи', 'кираса', 'покров'],
                icon: '🛡',
                type: 'armor',
            },
            weapon: {
                label: 'оружие',
                names: ['меч', 'булава', 'топор', 'палка', 'дубина', 'кинжал', 'заточка', 'рубанок'],
                icon: '⚔',
                type: 'weapon',
            },
        }
    }

    /**
     *
     * @return {Array<String>}
     */
    get stateLabels() {
        return [
            '🤢 еле жив ',
            '🤕 с будуна',
            '😬 стоять может',
            '😐 почти опасен',
            '😀 как огурчик',
            '🤖 терминатор',
        ];
    }

    /**
     *
     * @return {{helmet: {name: string, power: number}, armor: {name: string, power: number}, weapon: {name: string, power: number}}}
     */
    get defaultEquipment() {
        return {
            helmet: {
                name: 'никчемный шлемик',
                power: 1,
            },
            armor: {
                name: 'никчемный броник',
                power: 1,
            },
            weapon: {
                name: 'никчемный меч',
                power: 1,
            },
        }
    }

    /**
     *
     * @return {{helmet: {name: string, power: number}, armor: {name: string, power: number}, weapon: {name: string, power: number}}}
     */
    get defaultAdminEquipment() {
        return {
            helmet: {
                name: 'шлем великих админов',
                power: this.config.maxEquipmentPower,
            },
            armor: {
                name: 'бронь великих админов',
                power: this.config.maxEquipmentPower,
            },
            weapon: {
                name: 'меч великих админов',
                power: this.config.maxEquipmentPower,
            },
        }
    }

    getStateLabel(state) {
        state = state / 101;
        return this.stateLabels[Math.floor(state * this.stateLabels.length)];
    }

    _getNeededExpToLvl(lvl) {
        let exp = 0;
        for (let i = 0; i < lvl; i++) {
            exp += i * this.config.expToLevel;
        }
        return exp;
    }

    _getMaxAuctionCost() {
        return this.config.auctionMaxCostByPower * this.config.maxEquipmentPower;
    }

    /**
     *
     * @param {GameUserInfo} userInfo
     * @param {Number} [winInc]
     * @param {Number} [looseInc]
     * @return {Number}
     * @private
     */
    _getUserRating(userInfo, winInc = 0, looseInc = 0) {
        let duelsWin = userInfo.duelsWin + winInc;
        let duelsLoose = userInfo.duelsLoose + looseInc;
        return Math.round(10 * Math.sqrt(Math.max((duelsWin - duelsLoose) * 10, 1))) || 1;
    }

    /**
     *
     * @param {GameChatInfo} chatInfo
     * @param {Number} [winInc]
     * @param {Number} [looseInc]
     * @return {Number}
     * @private
     */
    _getChatRating(chatInfo, winInc = 0, looseInc = 0) {
        let duelsWin = chatInfo.duelsWin + winInc;
        let duelsLoose = chatInfo.duelsLoose + looseInc;
        return Math.round(10 * Math.sqrt(Math.max((duelsWin - duelsLoose) * 10, 1))) || 1;
    }

    /**
     *
     * @param {Array<GameUserInfo>} usersInfo
     * @return {Number}
     * @private
     */
    _getUsersAvgLvl(usersInfo) {
        let sumLvl = usersInfo.reduce((lvl, userInfo) => lvl + (userInfo.lvl || 1), 0);
        return Math.round(sumLvl / usersInfo.length) || 0;
    }

    _getDuelExp(usersInfo) {
        return Math.pow(this._getUsersAvgLvl([].concat(usersInfo)), 0.6) * 5 * this.config.expFromDuel;
    }

    /**
     *
     * @param {GameUserInfo} userInfo
     * @param {Number} chatId
     * @return {Promise.<GameUserInfo>}
     * @private
     */
    _getUserState(userInfo, chatId) {
        if (!chatId) {
            userInfo.active = userInfo.lastActive = 0;
            userInfo.state = 0;
            return Promise.resolve(userInfo);
        }
        let userId = userInfo.userId;
        let fromDate = new Date(Date.now() - this.config.userStateByHours * 36e5);
        fromDate.setMinutes(59, 59, 999);
        return UserHourStatistics.find({chatId, userId})
            .betweenDates(fromDate)
            .sort('-date.time')
            .exec()
            .then(docs => {
                if (!docs.length) {
                    userInfo.active = userInfo.lastActive = 0;
                    userInfo.state = 0;
                    return userInfo;
                }
                let reduceFunc = (to, from) => {
                    return to + from.countSymbols;
                };
                let fromDocs = docs.filter(doc => doc.date.time > Date.now() - this.config.userStateFromHours * 36e5)
                    .slice(0, this.config.userStateFromHours);
                let byStatus = docs.reduce(reduceFunc, 0) || 0;
                let fromStatus = fromDocs.reduce(reduceFunc, 0) || 0;
                userInfo.active = byStatus / this.config.userStateByHours;
                userInfo.lastActive = fromStatus / this.config.userStateFromHours;
                let status = this.config.defaultUserState / 100 * userInfo.lastActive / userInfo.active;
                if (status > 1) status = 1;
                status = Math.round(status * 100) || 0;
                userInfo.state = status;
                return userInfo;
            })
    }

    /**
     *
     * @param {GameUserInfo} userInfo
     * @return {GameUserInfo}
     * @private
     */
    _getPower(userInfo) {
        userInfo.activePower = Math.sqrt(userInfo.active || 0) * this.config.activePowerRatio * userInfo.state / 100;
        userInfo.activePower = Math.round(userInfo.activePower);
        userInfo.lvlPower = Math.pow(userInfo.lvl || 1, this.config.lvlPowerRatio);
        userInfo.lvlPower = Math.round(userInfo.lvlPower);
        userInfo.fullPower = (userInfo.equipmentPower || 0) + userInfo.activePower + userInfo.lvlPower;
        return userInfo;
    }

    /**
     *
     * @param chat
     * @param userId
     * @return {Promise.<*>}
     * @private
     */
    _getUserInfo(chat, userId) {
        let chatId = chat && chat.id;
        return GameUserInfo.find({userId}).exec().then(docs => {
            let doc;
            if (docs.length > 1) {
                docs.sort(
                    (a, b) =>
                        this.equipmentNames.reduce((res, name) => res + b[name].power - a[name].power, 0)
                );
                docs.slice(1).map(doc => doc.remove());
            }
            doc = docs[0];
            if (!doc) doc = new GameUserInfo({userId});
            /**
             *
             * @type {GameUserInfo}
             */
            let userInfo = Object.assign({}, doc._doc);
            userInfo.equipmentPower = 0;
            let defaultEquipment = this.bot.admins.includes(userId) ? this.defaultAdminEquipment : this.defaultEquipment;
            this.equipmentNames.map(name => {
                if (!userInfo[name].power) userInfo[name] = defaultEquipment[name];
                userInfo.equipmentPower += userInfo[name].power;
            });
            userInfo.lvl = 0;
            while (!(this._getNeededExpToLvl(userInfo.lvl + 1) > userInfo.exp)) userInfo.lvl++;
            userInfo.rating = this._getUserRating(userInfo);
            userInfo.name = chat && chat.userNames[userId].fullName || !userInfo.name && userId;
            return this._getUserState(userInfo, chatId).then(userInfo => this._getPower(userInfo));
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Array} users
     */
    _getAllUsersInfo(chat, users = (chat.users || [])) {
        return promiseFactory.allAsync(users.map(userId => this._getUserInfo(chat, userId)));
    }

    /**
     *
     * @param type
     * @param powerRatio
     * @return {*}
     * @private
     */
    _createEquipment(type, powerRatio = Math.random()) {
        let eq = this.equipmentInfo[type] || this.equipmentInfo[Object.keys(this.equipmentInfo)[0]];
        let namesAbout = ['великих', 'огненных', 'мускулистых', 'магических', 'бесстрашных', 'непобедимых', 'панических', 'драйвовых', 'четких', 'надежных', 'тайных', 'очевидных', 'ядерных', 'особенных', 'крутых', 'жестоких', 'печальных', 'доступных', 'суровых', 'бешеных', 'львиных'];
        let namesEnd = ['драконов', 'эльфов', 'берсерков', 'мастеров', 'воров', 'побоев', 'ударов', 'войн', 'битв', 'кровопролитий', 'воинов', 'алкоголиков', 'берегов', 'островов', 'многоножек', 'страусов', 'сосен', 'пинков', 'наград', 'бед', 'побед', 'цветков', 'канделябров', 'параш'];
        let randomItem = array => array[Math.floor(Math.random() * array.length)];
        let name = randomItem(eq.names) + ' ' + randomItem(namesAbout) + ' ' + randomItem(namesEnd);
        powerRatio = Math.max(Math.min(powerRatio, 1), 0);
        let ratio = powerRatio + (Math.random() * Math.random() * (1 - powerRatio));
        let power = Math.ceil(ratio * (this.config.maxEquipmentPower - 1)) + 1;
        return Object.assign({}, eq, {name, power});
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showChat(chat, message, command) {
        return promiseFactory.allAsync([
            GameChatInfo.findOne({chatId: chat.id}).exec(),
            this._getAllUsersInfo(chat),
        ]).then(([doc, usersInfo]) => {
            if (!doc) doc = new GameUserInfo({chatId: chat.id});
            let allPower = usersInfo.reduce(
                (power, userInfo) => power + userInfo.equipmentPower + userInfo.lvlPower,
                0,
            );
            let avgPower = Math.round(allPower / usersInfo.length);
            return message.setTitleTemplate(
                command.messageTemplate.title,
                chat.title,
                avgPower,
                this._getUsersAvgLvl(usersInfo),
                doc.gold,
                this._getChatRating(doc),
            ).send();
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    getSalary(chat, message, command) {
        if (this.salary[chat.id]) return;
        if (this.chatAuction[chat.id]) return message.setTitle(command.messageTemplate.failAuction).send();
        this.salary[chat.id] = true;
        return GameChatInfo.findOne({chatId: chat.id}).exec().then(doc => {
            if (!doc) doc = new GameChatInfo({chatId: chat.id});
            if (Date.now() - doc.lastSalary < this.config.salaryPeriod) {
                let minToSalary = this.config.salaryPeriod - (Date.now() - doc.lastSalary);
                this.salary[chat.id] = false;
                return message.setTitleTemplate(command.messageTemplate.titleFail, Math.ceil(minToSalary / 6e4)).send();
            } else if (doc.gold <= 0) {
                this.salary[chat.id] = false;
                return message.setTitleTemplate(command.messageTemplate.failGold).send();
            }
            return this._getAllUsersInfo(chat).then(usersInfo => {
                let chatLvl = this._getUsersAvgLvl(usersInfo);
                usersInfo.map(userInfo => {
                    if (Date.now() - userInfo.lastSalary < this.config.salaryPeriod) {
                        userInfo.lastActive = Math.max(userInfo.lastActive - userInfo.lastSalaryActive, 0) || 0;
                    }
                });
                usersInfo = usersInfo.filter(userInfo => userInfo.lastActive);
                if (!usersInfo.length) {
                    this.salary[chat.id] = false;
                    return;
                }
                let allSalary = Math.min(
                    this.config.salaryByUser * usersInfo.length * Math.ceil(chatLvl * this.config.salaryFromChatLvlRatio),
                    doc.gold,
                );
                let balanceSalary = allSalary;
                let allActive = usersInfo.reduce((active, userInfo) => active + userInfo.lastActive, 0);
                let promises = [];
                usersInfo.sort((a, b) => b.lastActive - a.lastActive);
                usersInfo.map(userInfo => {
                    if (balanceSalary < 1) return;
                    userInfo.salary = Math.ceil(allSalary * userInfo.lastActive / allActive);
                    if (userInfo.salary > balanceSalary) userInfo.salary = balanceSalary;
                    balanceSalary -= userInfo.salary;
                    let data = {
                        $inc: {gold: userInfo.salary},
                        $set: {
                            lastSalary: new Date(),
                            lastSalaryActive: userInfo.lastActive,
                        },
                    };
                    if (Date.now() - userInfo.lastSalary < this.config.salaryPeriod) {
                        data.$set = {
                            lastSalary: userInfo.lastSalary,
                            lastSalaryActive: userInfo.lastActive + userInfo.lastSalaryActive,
                        }
                    }
                    promises.push(GameUserInfo.update({
                        userId: userInfo.userId,
                    }, data, {
                        upsert: true,
                    }));
                });
                usersInfo = usersInfo.filter(userInfo => userInfo.salary);
                doc.lastSalary = Date.now();
                doc.gold -= allSalary;
                promises.push(doc.save());
                return promiseFactory.allAsync(promises).then(() => {
                    this.salary[chat.id] = false;
                    return message.setTitleTemplate(command.messageTemplate.title, allSalary, doc.gold)
                        .setBodyTemplate(
                            command.messageTemplate.body,
                            n => chat.userNames[usersInfo[n].userId].fullName,
                            n => usersInfo[n].salary,
                            n => usersInfo[n].salary + usersInfo[n].gold
                        )
                        .setTemplateLength(usersInfo.length)
                        .send();
                })
            })
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    showUsers(chat, message, command) {
        return this._getAllUsersInfo(chat).then(usersInfo => {
            usersInfo.sort((a, b) => b.equipmentPower + b.lvlPower - a.equipmentPower - a.lvlPower);
            return message.setTitleTemplate(command.messageTemplate.title, chat.title)
                .setBodyTemplate(
                    command.messageTemplate.body,
                    n => chat.userNames[usersInfo[n].userId].fullName,
                    n => usersInfo[n].lastActive
                        ? command.messageTemplate.activeText
                        : command.messageTemplate.notActiveText,
                    n => usersInfo[n].equipmentPower + usersInfo[n].lvlPower,
                    n => usersInfo[n].gold,
                    n => usersInfo[n].lvl,
                    n => usersInfo[n].rating,
                    n => this.getStateLabel(usersInfo[n].state),
                    n => usersInfo[n].state,
                )
                .setTemplateLength(usersInfo.length)
                .send();
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    startAuction(chat, message, command) {
        let auctionInfo = this.chatAuction[chat.id];
        if (auctionInfo) {
            if (auctionInfo instanceof Object) {
                let info = auctionInfo.users.filter(userInfo => userInfo.rate);
                if (info.length) {
                    auctionInfo.setRatesToMessageBody(info, message);
                } else {
                    message.setBody(command.messageTemplate.durationEmpty)
                }
                return message.setTitleTemplate(command.messageTemplate.titleDuration, auctionInfo.ratesText).send()
            }
            return message.setTitleTemplate(command.messageTemplate.failDuration).send();
        }
        this.chatAuction[chat.id] = true;
        let [, auctionCost = 0] = command.check.args.exec(message.getCommandText());
        auctionCost = Math.min(auctionCost, this._getMaxAuctionCost());
        return GameChatInfo.findOne({chatId: chat.id}).exec().then(doc => {
            if (!doc) doc = new GameChatInfo({chatId: chat.id});
            if (Date.now() - doc.lastAuction < this.config.auctionPeriod) {
                let minToSalary = this.config.auctionPeriod - (Date.now() - doc.lastAuction);
                this.chatAuction[chat.id] = false;
                return message.setTitleTemplate(command.messageTemplate.failPeriod, Math.ceil(minToSalary / 6e4)).send();
            } else if (doc.gold < auctionCost) {
                this.chatAuction[chat.id] = false;
                return message.setTitleTemplate(command.messageTemplate.failRate, doc.gold);
            }

            return this._getAllUsersInfo(chat).then(usersInfo => {
                if (!usersInfo.length) {
                    this.chatAuction[chat.id] = false;
                    return;
                }
                let chatLvl = this._getUsersAvgLvl(usersInfo);

                let equipmentCountFromType = Math.ceil(this.config.auctionEquipmentByChatLvl * chatLvl);
                let equipmentPowerRatio = auctionCost / this._getMaxAuctionCost();
                let equipments = this.equipmentNames.reduce((eq, type) => {
                    return eq.concat(new Array(equipmentCountFromType)
                        .fill(type)
                        .map(type => this._createEquipment(type, equipmentPowerRatio)))
                }, []);
                equipments.map((eq, num) => {
                    let x = eq.power;
                    eq.minRate = Math.ceil(this.config.salaryByUser * (Math.pow(x, 2.2) * 1.2 - 1.5 * x - Math.random()));
                    eq.rate = eq.minRate - 1;
                    eq.slot = num;
                });
                let rateCount = 0;
                let setRatesToMessageBody = (users, message) => {
                    message
                        .setBodyTemplate(
                            command.messageTemplate.finalInfoBody,
                            n => chat.userNames[users[n].userId].fullName,
                            n => users[n].slot + 1,
                            n => users[n].rate
                        )
                        .setTemplateLength(users.length);
                };
                /**
                 *  @param {Message} newMessage
                 */
                let onMessage = (newMessage) => {
                    let check = /^\D{0,10}ставка\D{1,10}(\d+)\D{1,10}(\d+)/i;
                    if (!check.test(newMessage.getCommandText())) return;
                    let [, slot, rate] = check.exec(newMessage.getCommandText());
                    slot--;
                    let userInfo = usersInfo.filter(userInfo => userInfo.userId === newMessage.user)[0];

                    if (!userInfo || !equipments[slot] || userInfo.slot === slot && userInfo.rate >= rate
                        || userInfo.gold < rate || rate < equipments[slot].minRate) return;
                    userInfo.rate = rate;
                    userInfo.rateCount = rateCount++;
                    userInfo.slot = slot;
                    new this.bot.Message({peer: newMessage.peer})
                        .setTitle(`[id${userInfo.userId}| Принята ставка на лот №${userInfo.slot+1} за ${userInfo.rate} голды]`).send();
                };
                let onEnd = () => {
                    let promises = [];
                    doc.lastAuction = Date.now();
                    doc.gold -= auctionCost;
                    usersInfo.map(userInfo => {
                        let eqUserInfo = equipments[userInfo.slot] && equipments[userInfo.slot].userInfo;
                        if (userInfo.slot !== undefined && (!eqUserInfo || userInfo.rate >= eqUserInfo.rate
                                && (userInfo.rate !== eqUserInfo.rate || userInfo.rateCount < eqUserInfo.rateCount))) {
                            equipments[userInfo.slot].userInfo = userInfo;
                        }
                    });
                    promises.push(doc.save());
                    promises.push(chat.removeListenerOn(chat.eventNames.message, onMessage));
                    equipments = equipments.filter(eq => eq.userInfo);
                    equipments.map(eq => {
                        promises.push(GameUserInfo.findOneAndUpdate({
                            userId: eq.userInfo.userId,
                        }, {
                            $inc: {gold: -eq.userInfo.rate},
                            $set: {
                                [eq.type]: {
                                    name: eq.name,
                                    power: eq.power,
                                },
                            },
                        }, {
                            upsert: true,
                        }));
                    });
                    return promiseFactory.allAsync(promises).then(() => {
                        this.chatAuction[chat.id] = false;
                        message.new.setTitleTemplate(command.messageTemplate.finalTitle)
                            .setBodyTemplate(
                                command.messageTemplate.finalBody,
                                n => chat.userNames[equipments[n].userInfo.userId].fullName,
                                n => equipments[n].icon,
                                n => equipments[n].name,
                                n => equipments[n].power,
                                n => equipments[n].userInfo.rate
                            )
                            .setTemplateLength(equipments.length);
                        if (!equipments.length) message.setEndTemplate(command.messageTemplate.failEmpty);
                        return message.send()
                    });
                };
                setTimeout(onEnd, this.config.auctionDuration * 6e4);
                setTimeout(() => {
                    let info = usersInfo.filter(userInfo => userInfo.rate);
                    if (info.length) {
                        setRatesToMessageBody(info, message.new);
                        message.setTitle(command.messageTemplate.finalInfoTitle)
                            .setTemplateLength(info.length);
                    } else {
                        message.new.setTitle(command.messageTemplate.finalInfoEmpty);
                    }
                    return message.send();
                }, (this.config.auctionDuration - 1) * 6e4);
                message
                    .setBodyTemplate(
                        command.messageTemplate.body,
                        n => n + 1,
                        n => equipments[n].icon,
                        n => equipments[n].name,
                        n => equipments[n].power,
                        n => equipments[n].minRate
                    )
                    .setTemplateLength(equipments.length);
                this.chatAuction[chat.id] = {
                    users: usersInfo,
                    ratesText: message.getText(),
                    setRatesToMessageBody
                };
                message.setTitleTemplate(command.messageTemplate.title, auctionCost)
                    .setEnd(command.messageTemplate.end);
                return message
                    .send()
                    .then(() => chat.on(chat.eventNames.message, onMessage));
            })
        });
    }

    /**
     *
     * @param {GameUserInfo} userInfo
     * @param {Message} message
     * @return {Message}
     */
    getUserInfoMessage(userInfo, message = new this.bot.Message) {
        let commandName = 'userInfo';
        let command = this.specification.commands.filter(command => command.name === commandName)[0];
        if (!command) return message;
        let names = this.equipmentNames;
        return message.setTitleTemplate(
            command.messageTemplate.title,
            userInfo.name,
            this.getStateLabel(userInfo.state),
            userInfo.state,
            userInfo.gold,
            userInfo.lvl,
            userInfo.exp,
            this._getNeededExpToLvl(userInfo.lvl + 1),
            userInfo.rating,
        )
            .setBodyTemplate(
                command.messageTemplate.body,
                n => this.equipmentInfo[names[n]].label,
                n => this.equipmentInfo[names[n]].icon,
                n => userInfo[names[n]].name,
                n => userInfo[names[n]].power
            )
            .setTemplateLength(names.length);
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    userInfo(chat, message, command) {
        let userIdOrName = command.check.args.exec(message.getCommandText())[1];
        let userId = userIdOrName && chat.findUser(userIdOrName) || message.user;
        return promiseFactory.allAsync([
            this._getUserInfo(chat, userId),
            GameDuelInfo.findOne({ userId }).exec(),
            GameRandomDuelInfo.findOne({ userId }).exec(),
        ]).then(([userInfo, duel, randomDuel]) => {
            this.getUserInfoMessage(userInfo, message);
            let getMinutes = (lastDuel = 0, timePeriod) => {
                return Math.ceil(Math.max(lastDuel + timePeriod - Date.now(), 0) / 6e4);
            };
            let duelMinutes = getMinutes(duel && +duel.date || 0, this.config.duelPeriod);
            let randomDuelMinutes = getMinutes(randomDuel && +randomDuel.date || 0, this.config.randomDuelPeriod);
            return message
                .setEndTemplate(
                    command.messageTemplate.end,
                    duelMinutes ? `через ${duelMinutes} мин.` : 'готов',
                    randomDuelMinutes ? `через ${randomDuelMinutes} мин.` : 'готов',
                )
                .send();
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    chatsTop(chat, message, command) {
        return GameChatInfo.find().sort({ rating: -1 }).limit(this.config.chatsTopCount).exec()
            .then(docs => {
                return this.bot.vk.api.call('messages.getConversationsById', {
                    peer_ids: docs.map(doc => doc.chatId).join(',')
                }).then(chats => {
                    chats = chats.items;
                    return message.setTitleTemplate(command.messageTemplate.title)
                        .setBodyTemplate(
                            command.messageTemplate.body,
                            n => n + 1,
                            n => {
                                let chat = chats.filter(chat => +chat.peer.id === +docs[n].chatId)[0];
                                let title = chat && chat.chat_settings.title || docs[n].chatId.toString();
                                title = title.replace(/(]|&#93;)/, '&#8969;');
                                // let adminId = chat.admin_id;
                                return title; // TODO: get user id
                                // return `[id${adminId}|${title}]`
                            },
                            n => docs[n].chatId - 2e9,
                            n => docs[n].rating
                        )
                        .setTemplateLength(docs.length)
                        .send();
                })
            })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    usersTop(chat, message, command) {
        return GameUserInfo.find().sort({ rating: -1 }).limit(this.config.usersTopCount).exec()
            .then(docs => {
                return this.bot.vk.api.users.get({
                    user_ids: docs.map(doc => doc.userId).join(',')
                }).then(users => {
                    return message.setTitleTemplate(command.messageTemplate.title)
                        .setBodyTemplate(
                            command.messageTemplate.body,
                            n => n + 1,
                            n => docs[n].userId,
                            n => {
                                let user = users.filter(user => user.id === docs[n].userId)[0];
                                return user && `${user.first_name} ${user.last_name}` || docs[n].userId;
                            },
                            n => docs[n].rating,
                        )
                        .setTemplateLength(docs.length)
                        .send();
                })
            })
    }

    /**
     *
     * @param {Message} message
     * @param {GameUserInfo} fromUserInfo
     * @param {GameUserInfo} toUserInfo
     * @return {{winner: GameUserInfo, looser: GameUserInfo, message: Message}}
     */
    _duel(message, fromUserInfo, toUserInfo) {
        let fromMessage = this.getUserInfoMessage(fromUserInfo);
        let toMessage = this.getUserInfoMessage(toUserInfo);
        fromUserInfo.luck = Math.round(Math.random() * fromUserInfo.fullPower * this.config.maxPowerLuck);
        toUserInfo.luck = Math.round(Math.random() * toUserInfo.fullPower * this.config.maxPowerLuck);
        fromUserInfo.duelPower = fromUserInfo.fullPower + fromUserInfo.luck;
        toUserInfo.duelPower = toUserInfo.fullPower + toUserInfo.luck;
        let getArgs = userInfo => [
            this.specification.messageTemplate.userInfoEnd + '\n',
            userInfo.equipmentPower,
            userInfo.activePower,
            userInfo.lvlPower,
            userInfo.luck,
            userInfo.duelPower,
        ];
        fromMessage._titleTemplateString = toMessage._titleTemplateString = this.specification.messageTemplate.userInfoSmall;
        fromMessage.setBodyTemplate('');
        toMessage.setBodyTemplate('');
        fromMessage.setEndTemplate(...getArgs(fromUserInfo));
        toMessage.setEndTemplate(...getArgs(toUserInfo));
        let [winner, looser] = [fromUserInfo, toUserInfo];
        if (fromUserInfo.duelPower < toUserInfo.duelPower) [winner, looser] = [looser, winner];
        let duelFinals = this.specification.messageTemplate.duelFinals;
        let duelFinal = duelFinals[Math.floor(Math.random() * duelFinals.length)];
        let promises = [];
        message.new
            .setTitleTemplate(
                this.specification.messageTemplate.duelInfo,
                fromMessage.getText(),
                toMessage.getText()
            )
            .setBodyTemplate(
                duelFinal,
                winner.name,
                looser.name,
                winner.weapon.name,
                looser[this.equipmentNames[Math.floor(Math.random() * this.equipmentNames.length)]].name,
                winner.name,
            );
        return {
            winner,
            looser,
            message,
        };
    };

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    duel(chat, message, command) {
        let userIdOrName = command.check.args.exec(message.getCommandText())[1];
        let userId = chat.findUser(userIdOrName);
        if (userId === message.user) return;
        if (!userId) return message.setTitleTemplate(command.messageTemplate.failUser, userIdOrName).send();
        if (this.chatDuels[message.user] || this.chatDuels[userId])
            return message.setTitleTemplate(command.messageTemplate.failRequest,
                chat.userNames[this.chatDuels[message.user] ? message.user : userId].fullName).send();
        this.chatDuels[message.user] = this.chatDuels[userId] = true;
        let duelInfo = {
            userId: message.user,
        };
        return GameDuelInfo.findOne(duelInfo).exec().then(doc => {
            if (doc && Date.now() - doc.date < this.config.duelPeriod) {
                let minToDuel = this.config.duelPeriod - (Date.now() - doc.date);
                this.chatDuels[message.user] = this.chatDuels[userId] = false;
                return message.setTitleTemplate(
                    command.messageTemplate.failPeriod,
                    chat.userNames[message.user].fullName,
                    Math.ceil(minToDuel / 6e4)
                ).send();
            }
            let duelTimeout;
            let onMessage;
            let stop = () => {
                clearTimeout(duelTimeout);
                delete this.chatDuels[message.user];
                delete this.chatDuels[userId];
                return chat.removeListenerOn(chat.eventNames.message, onMessage);
            };
            duelTimeout = setTimeout(() => stop().then(
                () => message.new
                    .setTitleTemplate(
                        command.messageTemplate.failTimeout,
                        chat.userNames[message.user].fullName,
                        chat.userNames[userId].fullName
                    )
                    .send()
            ), 6e4);
            /**
             *
             * @param {Message} newMessage
             */
            onMessage = newMessage => {
                let check = /^.?.?готов/i;
                if (newMessage.user !== userId || !check.test(newMessage.getCommandText())) return;
                return stop().then(() => {
                    return this._getAllUsersInfo(chat, [message.user, userId]).then(([fromUserInfo, toUserInfo]) => {
                        return GameDuelInfo.findOneAndUpdate(duelInfo, { date: new Date }, { upsert: true }).exec()
                            .then(() => this._duel(message, fromUserInfo, toUserInfo))
                            .then(({ winner, looser, message}) => {
                                let powerRatio = looser.fullPower / winner.fullPower;
                                let winnerExp = Math.round(this._getDuelExp(winner) * powerRatio) || 0;
                                let looserExp = Math.round(this._getDuelExp(looser) / powerRatio) || 0;
                                let winnerRating = this._getUserRating(winner, 1);
                                let looserRating = this._getUserRating(looser, 0, 1);
                                message.setEndTemplate(
                                    command.messageTemplate.end,
                                    chat.userNames[winner.userId].fullName,
                                    winnerRating - winner.rating,
                                    winnerExp,
                                    chat.userNames[looser.userId].fullName,
                                    looser.rating - looserRating,
                                    looserExp,
                                );
                                return promiseFactory.allAsync([
                                    GameUserInfo.findOneAndUpdate({
                                        userId: winner.userId,
                                    }, {
                                        $inc: {
                                            duelsWin: 1,
                                            exp: winnerExp,
                                        },
                                        $set: {
                                            rating: winnerRating,
                                        },
                                    }, {
                                        upsert: true
                                    }),
                                    GameUserInfo.findOneAndUpdate({
                                        userId: looser.userId,
                                    }, {
                                        $inc: {
                                            duelsLoose: 1,
                                            exp: looserExp,
                                        },
                                        $set: {
                                            rating: looserRating,
                                        },
                                    }, {
                                        upsert: true
                                    }),
                                    message.send(),
                                ]);
                            });
                    })
                });
            };
            return chat.on(chat.eventNames.message, onMessage, this).then(
                () => message
                    .setTitleTemplate(
                        command.messageTemplate.startDuel,
                        chat.userNames[message.user].fullName,
                        `[id${userId}|${chat.userNames[userId].fullName}]`
                    )
                    .send()
            );
        })
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    randomDuel(chat, message, command) {
        if (this.chatAuction[chat.id]) return message.setTitle(command.messageTemplate.failAuction).send();
        let [, rate = 0] = command.check.args.exec(message.getCommandText());
        let duelInfo = {
            userId: message.user,
        };

        return GameRandomDuelInfo.findOne(duelInfo).exec().then(doc => {
            if (doc && Date.now() - doc.date < this.config.randomDuelPeriod) {
                let minToDuel = this.config.randomDuelPeriod - (Date.now() - doc.date);
                return message.setTitleTemplate(
                    command.messageTemplate.failPeriod,
                    chat.userNames[message.user].fullName,
                    Math.ceil(minToDuel / 6e4)
                ).send();
            }

            return this._getUserInfo(null, message.user).then((fromUserInfo) => {
                if (fromUserInfo.gold < rate) {
                    return message.setTitleTemplate(command.messageTemplate.failGold, fromUserInfo.gold).send();
                }
                let maxRate = fromUserInfo.lvl * this.config.maxRateRandomDuelPerLvl;
                if (rate > maxRate) {
                    return message
                        .setTitleTemplate(command.messageTemplate.failRate, fromUserInfo.lvl, maxRate)
                        .send();
                }
                let params = this.equipmentNames.map(name => {
                    return {
                        [`${name}.power`]: {
                            $gte: fromUserInfo[name].power
                        }
                    }
                });
                return GameUserInfo.find({
                    $or: params,
                    userId: { $nin: [fromUserInfo.userId] }
                }).limit(50).exec().then(usersInfo => {
                    let userInfo = usersInfo[Math.floor(Math.random() * usersInfo.length)];
                    if (!userInfo) return message.setTitleTemplate(command.messageTemplate.failChat).send();
                    let toUserInfo;
                    fromUserInfo.name = chat.userNames[message.user].fullName;
                    return this._getUserInfo(null, userInfo.userId)
                        .then(info => {
                            toUserInfo = info;
                            for (let chat of Object.values(this.bot.chats)) {
                                if (chat.users.includes(toUserInfo.userId)) {
                                    toUserInfo.name = chat.userNames[toUserInfo.userId].fullName;
                                    break;
                                }
                            }
                        })
                        .then(() => GameRandomDuelInfo.findOneAndUpdate(
                            duelInfo, {date: new Date}, {upsert: true}
                        ).exec())
                        .then(() => this._duel(message, fromUserInfo, toUserInfo))
                        .then(({winner, looser, message}) => {
                            let powerRatio = looser.fullPower / winner.fullPower;
                            let isWinner = winner === fromUserInfo;
                            let direction = isWinner ? 1 : -1;
                            let exp = Math.round(this._getDuelExp(fromUserInfo) * Math.pow(powerRatio, direction)) || 0;
                            let rating = this._getUserRating(fromUserInfo, + isWinner, + !isWinner);
                            let template = isWinner
                                ? command.messageTemplate.endWinner
                                : command.messageTemplate.endLooser;
                            message.setEndTemplate(
                                template,
                                fromUserInfo.name,
                                toUserInfo.userId,
                                toUserInfo.name,
                                +rate,
                                Math.abs(fromUserInfo.rating - rating),
                                exp,
                            );
                            return promiseFactory.allAsync([
                                GameUserInfo.findOneAndUpdate({
                                    userId: fromUserInfo.userId,
                                }, {
                                    $inc: {
                                        [isWinner ? 'duelsWin' : 'duelsLoose']: 1,
                                        exp: exp,
                                        gold: direction * rate,
                                    },
                                    $set: {
                                        rating
                                    },
                                }, {
                                    upsert: true
                                }),
                                message.send(),
                            ]);
                        });
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
    chatsDuel(chat, message, command)   {
        if (this.chatAuction[chat.id]) return message.setTitle(command.messageTemplate.failAuction).send();
        let [, rate = 0] = command.check.args.exec(message.getCommandText());
        let chats = this.chats.filter(c => c.id !== chat.id && c.type === 'chat');
        let randomChat = chats[Math.floor(Math.random() * chats.length)];
        if (!randomChat) return message.setTitleTemplate(command.messageTemplate.failChat).send();

        return promiseFactory.allAsync([
            GameChatInfo.findOne({chatId: chat.id}).exec(),
            GameChatInfo.findOne({chatId: randomChat.id}).exec()
        ]).then(([doc, randomDoc]) => {
            if (!doc) doc = new GameChatInfo({chatId: chat.id});
            if (!randomDoc) randomDoc = new GameChatInfo({chatId: randomChat.id});
            if (rate > doc.gold) return message.setTitleTemplate(
                command.messageTemplate.failRate,
                doc.gold,
            ).send();
            if (doc && Date.now() - doc.lastChatDuel < this.config.chatDuelPeriod) {
                let minToDuel = this.config.chatDuelPeriod - (Date.now() - doc.lastChatDuel);
                return message.setTitleTemplate(
                    command.messageTemplate.failPeriod,
                    Math.ceil(minToDuel / 6e4)
                ).send();
            }

            return promiseFactory.allAsync([
                this._getAllUsersInfo(chat),
                this._getAllUsersInfo(randomChat),
            ]).then(([fromChatUsers, toChatUsers]) => {
                let chatLvl = this._getUsersAvgLvl(fromChatUsers);
                let maxRate = chatLvl * this.config.maxRateChatDuelPerLvl;
                if (rate > maxRate) return message.setTitleTemplate(
                    command.messageTemplate.failRateLvl,
                    chatLvl,
                    maxRate,
                ).send();
                fromChatUsers = fromChatUsers.filter(userInfo => userInfo.lastActive);
                toChatUsers = toChatUsers.filter(userInfo => userInfo.lastActive);
                let fromPower = fromChatUsers.reduce((power, userInfo) => power + userInfo.fullPower, 0);
                let toPower = toChatUsers.reduce((power, userInfo) => power + userInfo.fullPower, 0) || 0;
                let fromAvgPower = Math.round(fromPower / fromChatUsers.length)==NaN ? 0 : Math.round(fromPower / fromChatUsers.length);
                let toAvgPower = Math.round(toPower / toChatUsers.length) || 0;
                let fromUsersPower = fromChatUsers.length * this.config.chatDuelUserCountRatio;
                let toUsersPower = toChatUsers.length * this.config.chatDuelUserCountRatio || 0;
                let fromFullPower = fromAvgPower + fromUsersPower;
                let toFullPower = toAvgPower + toUsersPower;
                let isWinner = fromFullPower >= toFullPower;
                let direction = isWinner ? 1 : -1;
                let goldRatio = isWinner ? Math.min(fromFullPower / (toFullPower || 1), 2) : 1;
                let gold = Math.round(fromChatUsers.length * this.config.salaryByUser * goldRatio);
                if (!isWinner) gold *= this.config.chatDuelLooserGoldRatio;
                gold = Math.round(gold);
                let exp = Math.round(this._getDuelExp(fromChatUsers) * toFullPower / fromFullPower) || 0;
                doc.gold += gold + rate * direction ;
                doc.lastChatDuel = Date.now();
                doc[isWinner ? 'duelsWin' : 'duelsLoose'] += 1;
                doc.rating = this._getChatRating(doc);
                let endTemplate = isWinner ? command.messageTemplate.endWin : command.messageTemplate.endLoose;
                return promiseFactory.allAsync([
                    doc.save(),
                    GameUserInfo
                        .updateMany({
                            userId: { $in: fromChatUsers.map(userInfo => userInfo.userId) },
                        }, {
                            $inc: {
                                exp,
                            },
                        }, {
                            upsert: true,
                        }).exec(),
                    message
                        .setTitleTemplate(
                            command.messageTemplate.title,
                            chat.title,
                            chat.id - 2e9,
                            fromAvgPower,
                            fromUsersPower,
                            this._getChatRating(doc),
                            randomChat.title,
                            randomChat.id - 2e9,
                            toAvgPower,
                            toUsersPower,
                            this._getChatRating(randomDoc),
                        )
                        .setEndTemplate(
                            endTemplate,
                            gold,
                            rate,
                            exp,
                        )
                        .send(),
                ])
            })
        });
    }

    /**
     *
     * @param {Chat} chat
     * @param {Message} message
     * @param {SpecificationCommand} command
     */
    timers(chat, message, command) {
        return promiseFactory.allAsync([
            GameDuelInfo.find({ userId: { $in: chat.users } }).exec(),
            GameRandomDuelInfo.find({ userId: { $in: chat.users } }).exec(),
            GameChatInfo.findOne({ chatId: chat.id }).exec(),
        ]).then(([duels, randomDuels, chatInfo]) => {
            let chatDuel = chatInfo && chatInfo.lastChatDuel || 0;
            let chatSalary = chatInfo && chatInfo.lastSalary || 0;
            let chatAuction = chatInfo && chatInfo.lastAuction || 0;
            let getMinutes = (lastDuel = 0, timePeriod) => {
                return Math.ceil(Math.max(lastDuel + timePeriod - Date.now(), 0) / 6e4);
            };
            let users = chat.users.map(userId => {
                let duel = duels.filter(doc => doc.userId === userId)[0];
                let randomDuel = randomDuels.filter(doc => doc.userId === userId)[0];
                return {
                    id: userId,
                    duel: getMinutes(duel && +duel.date || 0, this.config.duelPeriod),
                    randomDuel: getMinutes(randomDuel && +randomDuel.date || 0, this.config.randomDuelPeriod),
                };
            });
            return message
                .setTitleTemplate(
                    command.messageTemplate.title,
                    getMinutes(chatAuction, this.config.auctionPeriod),
                    getMinutes(chatDuel, this.config.chatDuelPeriod),
                    getMinutes(chatSalary, this.config.salaryPeriod),
                )
                .setBodyTemplate(
                    command.messageTemplate.body,
                    n => chat.userNames[users[n].id].fullName,
                    n => users[n].duel ? users[n].duel + ' мин.' : 'готов',
                    n => users[n].randomDuel ? users[n].randomDuel + ' мин.' : 'готов',
                )
                .setTemplateLength(users.length)
                .send();
        })
    }

};
