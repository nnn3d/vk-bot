let mongoose = require('mongoose');

let GameDuelInfoSchema = mongoose.Schema({
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

GameDuelInfoSchema.index({
    chatId: 1,
    userId: 1,
}, {unique: true});

let GameDuelInfo = mongoose.model('GameDuelInfo', GameDuelInfoSchema);

module.exports = GameDuelInfo;