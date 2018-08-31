require('dotenv').config();
let admins = [468910494, 266979404];

let vipConfig = {
    token: process.env.YANDEX_TOKEN,
    admins: admins,
    freeChats: [],
    monthCost: 100,
    checkInterval: 6e5,
    antiCaptcha: {
        vipBots: [
            470997341,
            472073739,
        ],
    },
    payOutletId: process.env.SIMPLE_PAY_OUTLET_ID,
    paySecretKey: process.env.SIMPLE_PAY_SECRET_KEY,
    payResultSecretKey: process.env.SIMPLE_PAY_RESULT_SECRET_KEY,
    appId: process.env.VK_APP_ID,
    appSecret: process.env.VK_APP_SECRET,
};
let antiCaptchaConfig = {
    token: process.env.ANTI_CAPTCHA_TOKEN
};
let webConfig = {
    port: 8051,
    appId: process.env.VK_APP_ID,
    appSecret: process.env.VK_APP_SECRET,
};
let infoConfig = {
    yandexToken: 'trnsl.1.1.20171109T002415Z.c6f8f77e43b661ce.e51173564282a230a8377b2767333a0ebf58427a',
};

let adminConfig = {};

let baseConfig = require('./base');

module.exports = {
    bot: {
        name: 'тестмет',
        admins,
        dev: {
            chats: [5572944, 2000000030],
        },
    },
    vk: Object.assign({}, baseConfig.vk, { limit: 1, proxy: null }),
    // additionalTokens: baseConfig.additionalTokens,
    db: baseConfig.db,
    express: {
      port: '8080',
    },
    coreModules: [
        // new (require('../coreModules/Vip'))(vipConfig),
        // new (require('../coreModules/MiniAntiCaptcha'))(antiCaptchaConfig),
        // new (require('../coreModules/GroupsModule')),
        // new (require('../coreModules/Metrics')),
        // new (require('../coreModules/Web'))(webConfig),
    ],
    modules: [
        new (require('../modules/Statistics')),
        new (require('../modules/Charts')),
        new (require('../modules/Info'))(infoConfig),
        new (require('../modules/CommandList')),
        new (require('../modules/CommandAccess')),
        new (require('../modules/ChatMessageEventBooster')),
        new (require('../modules/CommandAccess/Admin'))(adminConfig),
        new (require('../modules/RulesAndWelcome')),
        new (require('../modules/BotNameChange')),
        // new (require('../modules/ChatSpamBan')),
        // new (require('../modules/ChatNameAndPhoto')),
        new (require('../modules/Pictures')),
        new (require('../modules/Marriage')),
        // new (require('../modules/Communication')),
        new (require('../modules/Game')),
        new (require('../modules/Notes')),
        new (require('../modules/Lists')),
        new (require('../modules/UserNickname')),
        new (require('../modules/News')),
        // new (require('../modules/FriendsControl')),
        // new (require('../modules/AutoInviteToChat')),
        // new (require('../modules/ChatInviteBan')),
        new (require('../modules/Utils')),
    ],
    groupTokens: [
        // {
        //     token: process.env.VK_TOKEN_AG_1,
        //     proxy: 'http://amJYh5:wr8X5V@185.206.120.226:8000',
        //     limit: 7,
        // },
    ]
};
