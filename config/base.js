let admins = [
    468910494, 266979404, // humans
    // bots
];
let os = require('os');

module.exports = {
    bot: {
        name: ['мия','торч', 'миа'],
        admins,
    },
    // vk: {
    //     token: process.env.VK_TOKEN, // 475932064
    //     //proxy: 'http://cr75ng:MraHem@185.40.106.34:8000',
    //     // proxy: 'http://SsMYyiLDCf:ZkQXiNRB6U@5.8.54.26:20968',
    //     call: 'execute',
    //     limit: 3 / (os.cpus().length - 1),
    //     authCaptcha: 4,
    //     longpollWait: 200,
    //     longpollCount: 2,
    //     restartWait: 300,
    //     timeout: 6000,
    // },
    vk: {
        type: 'group',
        token: process.env.VK_TOKEN_AG_1,
        call: 'execute',
        limit: 7,
        authCaptcha: 4,
        longpollWait: 200,
        longpollCount: 2,
        restartWait: 300,
        timeout: 6000,
    },
    db: {
        uri: 'mongodb://localhost/',
        name: 'bot',
        options: {
            socketOptions: {
                socketTimeoutMS: 24000,
                keepAlive: 10000,
                connectTimeoutMs: 30000,
            }
        }
    },
    additionalTokens: [
        // {
        //     token: process.env.VK_TOKEN_AC_1, //
        //     proxy: 'http://cr75ng:MraHem@185.40.104.3:8000',
        //     // proxy: 'http://e2a3Am:FAeVPL@194.28.208.72:8000',
        //     // proxy: 'http://b0vcMPCqg3:zAdsfkbuet@185.172.131.232:10753',
        // },
        // {
        //     token: process.env.VK_TOKEN_AC_2, //
        //     proxy: 'http://cr75ng:MraHem@185.40.104.88:8000',
        //     // proxy: 'http://QBZ3FN:Af4kg2@185.225.11.88:8000',
        //     // proxy: 'http://EK1Rut5Aod:CBJhYbMaQx@185.128.107.142:19922',
        // },
        // {
        //     token: process.env.VK_TOKEN_AC_3, //
        //     proxy: 'http://amJYh5:wr8X5V@185.206.120.226:8000',
        //     // proxy: 'http://Qn0vBPwOXZ:iLwIYkCJ8e@91.229.189.21:57933',
        // },
    ],
    // groupTokens: [
    //      {
    //          token: process.env.VK_TOKEN_AG_1,
    //       //   proxy: 'http://amJYh5:wr8X5V@185.206.120.226:8000',
    //          call: 'execute',
    //          limit: 7,
    //          authCaptcha: 4,
    //          longpollWait: 200,
    //          longpollCount: 2,
    //          restartWait: 300,
    //          timeout: 6000,
    //      },
    // ]
};
