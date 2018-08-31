let mongoose = require('mongoose');

let userStatisticsSchema = mongoose.Schema({
    userId: {
        type: Number,
        required: true,
    },
    chatId: {
        type: Number,
        required: true,
    },
    countSymbols: {
        type: Number,
        default: 0,
        get: v => Math.round(v),
        set: v => Math.round(v),
    },
    countMessages: {
        type: Number,
        default: 0,
        get: v => Math.round(v),
        set: v => Math.round(v),
    },
    countStickers: {
        type: Number,
        default: 0,
        get: v => Math.round(v),
        set: v => Math.round(v),
    },
    countForwards: {
        type: Number,
        default: 0,
        get: v => Math.round(v),
        set: v => Math.round(v),
    },
    countAttachments: {
        type: Number,
        default: 0,
        get: v => Math.round(v),
        set: v => Math.round(v),
    },
    countAudio: {
        type: Number,
        default: 0,
        get: v => Math.round(v),
        set: v => Math.round(v),
    },
    countCommands: {
        type: Number,
        default: 0,
        get: v => Math.round(v),
        set: v => Math.round(v),
    },
    _lastActivity: {
        type: Number,
        default: 0,
        get: v => Math.round(v),
        set: v => Math.round(v),
    }
});

userStatisticsSchema.index({
    userId: 1,
    chatId: 1,
}, {unique: true});

userStatisticsSchema.virtual('lastActivity')
    .get(function () {
        return this._lastActivity;
    })
    .set(function (time) {
        if (this._lastActivity < time || isNaN(this._lastActivity)) {
            this._lastActivity = time;
        }
    });

let UserStatistics = mongoose.model('UserStatistics', userStatisticsSchema);

module.exports = UserStatistics;