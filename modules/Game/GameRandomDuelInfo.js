let mongoose = require('mongoose');

let GameRandomDuelInfoSchema = mongoose.Schema({
    userId: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: () => new Date(),
        expires: '1h',
    },
});

GameRandomDuelInfoSchema.index({
    chatId: 1,
    userId: 1,
}, {unique: true});

let GameRandomDuelInfo = mongoose.model('GameRandomDuelInfo', GameRandomDuelInfoSchema);

module.exports = GameRandomDuelInfo;