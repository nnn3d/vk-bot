let mongoose = require('mongoose');

let GameChatInfoSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
        unique: true,
    },
    lastAuction: {
        type: Number,
        default: 0,
    },
    lastSalary: {
        type: Number,
        default: 0,
    },
    lastChatDuel: {
        type: Number,
        default: 0,
    },
    duelsWin: {
        type: Number,
        default: 0,
    },
    duelsLoose: {
        type: Number,
        default: 0,
    },
    rating: {
        type: Number,
        default: 0,
    },
    gold: {
        type: Number,
        default: 0,
    },
});

GameChatInfoSchema.index({
    userId: 1,
}, {unique: true});

GameChatInfoSchema.index({
    rating: 1,
});

let GameChatInfo = mongoose.model('GameChatInfo', GameChatInfoSchema);

module.exports = GameChatInfo;