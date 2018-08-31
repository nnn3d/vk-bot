const mongoose = require('mongoose');

let userHourStatisticsSchema = mongoose.Schema({
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
    date: {
        year: {
            type: Number,
            default: () => new Date().getFullYear(),
            get: v => Math.round(v),
            set: v => Math.round(v),
        },
        month: {
            type: Number,
            default: () => new Date().getMonth(),
            min: 0,
            max: 11,
            get: v => Math.round(v),
            set: v => Math.round(v),
        },
        day: {
            type: Number,
            default: () => new Date().getDate(),
            min: 1,
            max: 31,
            get: v => Math.round(v),
            set: v => Math.round(v),
        },
        hours: {
            type: Number,
            default: () => new Date().getHours(),
            min: 0,
            max: 23,
            get: v => Math.round(v),
            set: v => Math.round(v),
        },
        time: {
            type: Number,
            default: () => new Date().getTime(),
            get: v => Math.round(v),
            set: v => Math.round(v),
        }
    }
});

userHourStatisticsSchema.index({
    chatId: 1,
    userId: 1,
    'date.year': 1,
    'date.month': 1,
    'date.day': 1,
    'date.hours': 1,
}, {unique: true});

userHourStatisticsSchema.index({
    'date.time': 1,
    chatId: 1,
    userId: 1,
});

userHourStatisticsSchema.pre('save', function(next) {
    this.date.time = this.fullDate.getTime() || 0;
    next();
});

userHourStatisticsSchema.virtual('fullDate')
    .get(function () {
       return new Date(this.date.year, this.date.month, this.date.day, this.date.hours);
    })
    .set(function (date) {
        if (!(date instanceof Date)) date = new Date(date);
        this.date.year = date.getFullYear();
        this.date.month = date.getMonth();
        this.date.day = date.getDate();
        this.date.hours = date.getHours();
        this.time = date.getTime();
    });

userHourStatisticsSchema.query.byDate = function (date = new Date()) {
    if (!(date instanceof Date)) date = new Date(date);
    return this.find({
        'date.year': date.getFullYear(),
        'date.month': date.getMonth(),
        'date.day': date.getDate(),
        'date.hours': date.getHours(),
    })
};

userHourStatisticsSchema.query.betweenDates = function (date1, date2 = new Date()) {
    if (!(date1 instanceof Date)) date1 = new Date(date1);
    if (!(date2 instanceof Date)) date2 = new Date(date2);
    if (date1.getTime() > date2.getTime()) [date1, date2] = [date2, date1];
    return this.find({
        'date.time': { $gte: date1.getTime(), $lte: date2.getTime() },
    })
};

let UserHourStatistics = mongoose.model('UserHourStatistics', userHourStatisticsSchema);

module.exports = UserHourStatistics;