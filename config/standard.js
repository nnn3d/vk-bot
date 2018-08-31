require('dotenv').config();
// let admins = [468910494, 5572944, 266979404];
let admins = [
    468910494, 266979404, 225967360, // humans
    // bots
];
let vipConfig = {
    token: process.env.YANDEX_TOKEN,
    admins: admins,
    freeChats: [],
    monthCost: 100,
    checkInterval: 6e5,
    antiCaptcha: {
        vipBots: [
            486666276,
            486785741,
            486847953,
        ],
    },
    payOutletId: process.env.SIMPLE_PAY_OUTLET_ID,
    paySecretKey: process.env.SIMPLE_PAY_SECRET_KEY,
    payResultSecretKey: process.env.SIMPLE_PAY_RESULT_SECRET_KEY,
    appId: process.env.VK_APP_ID,
    appSecret: process.env.VK_APP_SECRET,
};
let antiCaptchaConfig = {
    token: process.env.ANTI_CAPTCHA_TOKEN,
    onlyAdditional: true,
};
let webConfig = {
    appId: process.env.VK_APP_ID,
    appSecret: process.env.VK_APP_SECRET,
};
let infoConfig = {
    yandexToken: 'trnsl.1.1.20171109T002415Z.c6f8f77e43b661ce.e51173564282a230a8377b2767333a0ebf58427a',
};
let chatSpamBanConfig = require('./userBanConfig');

let statisticsConfig = require('./chatBanConfig');

let adminConfig = {
    // token: {
    //     token: process.env.VK_TOKEN_ADMIN, // 471756819
    //     proxy: 'http://yKBWLd:35XeQ4@46.161.22.106:8000',
    //     // proxy: 'http://nCwbcRE0aB:yIHGxR6z0s@91.243.60.219:14199',
    // }
};

let friendsConfig = {
    periodToCheck: 2e5,
    unique: false,
    countAdditionalAccounts: 10,
};

let baseConfig = require('./base');

module.exports = Object.assign({}, baseConfig, {
    bot: {
        name: ['мия','торч', 'миа'],
        admins,
    },
    coreModules: [
        new (require('../coreModules/ClusterMode')),
        new (require('../coreModules/Vip'))(vipConfig),
        // new (require('../coreModules/MiniAntiCaptcha'))(antiCaptchaConfig),
        // new (require('../coreModules/GroupsModule')),
        new (require('../coreModules/Metrics')),
        new (require('../coreModules/Web'))(webConfig),
    ],
    modules: [
        new (require('../modules/Statistics'))(statisticsConfig),
        new (require('../modules/Charts')),
        new (require('../modules/Info'))(infoConfig),
        new (require('../modules/Game')),
        new (require('../modules/Notes')),
        new (require('../modules/Lists')),
        new (require('../modules/CommandList')),
        new (require('../modules/CommandAccess')),
        new (require('../modules/CommandAccess/Admin'))(adminConfig),
        new (require('../modules/MoveChat'))(adminConfig),
        new (require('../modules/ChatMessageEventBooster')),
        new (require('../modules/RulesAndWelcome')),
        new (require('../modules/BotNameChange')),
        new (require('../modules/ChatSpamBan'))(chatSpamBanConfig),
        // new (require('../modules/ChatNameAndPhoto')),
        new (require('../modules/Pictures')),
        new (require('../modules/Marriage')),
        new (require('../modules/UserNickname')),
        new (require('../modules/News')),
        // new (require('../modules/Communication')),
        // new (require('../modules/FriendsControl'))(friendsConfig),
        // new (require('../modules/AutoInviteToChat')),
        // new (require('../modules/ChatInviteBan')),
        new (require('../modules/Utils')),
    ]
});
