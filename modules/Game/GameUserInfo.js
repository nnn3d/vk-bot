let mongoose = require('mongoose');

let GameUserInfoSchema = mongoose.Schema({
    chatId: {
        type: Number,
    },
    userId: {
        type: Number,
        required: true,
    },
    gold: {
        type: Number,
        default: 0,
    },
    helmet: {
        name: String,
        power: {
            type: Number,
            default: 0,
        },
    },
    armor: {
        name: String,
        power: {
            type: Number,
            default: 0,
        },
    },
    weapon: {
        name: String,
        power: {
            type: Number,
            default: 0,
        },
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
    exp: {
        type: Number,
        default: 0,
        get: (v) => Math.round(v),
    },
    lastSalary: {
        type: Date,
        default: new Date(0),
    },
    lastSalaryActive: {
        type: Number,
        default: 0,
    },
});

GameUserInfoSchema.index({
    userId: 1,
}, {unique: true});

GameUserInfoSchema.index({
    rating: 1,
});

let GameUserInfo = mongoose.model('GameUserInfo', GameUserInfoSchema);

module.exports = GameUserInfo;
