let mongoose = require('mongoose');

let chatStatisticsSchema = mongoose.Schema({
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
});

chatStatisticsSchema.index({
    chatId: 1,
}, {unique: true});

let ChatStatistics = mongoose.model('ChatStatistics', chatStatisticsSchema);

module.exports = ChatStatistics;