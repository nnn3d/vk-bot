const Bot = require('./classes/core/Bot');
const config = require('./config/dev');
global.bot = new Bot(config);
global.bot.start();