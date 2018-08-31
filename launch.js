"use strict";

const Bot = require('./classes/core/Bot');
const config = require('./config/standard');
global.bot = new Bot(config);
global.bot.start();