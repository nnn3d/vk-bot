"use strict";

const mongoose = require('mongoose');

let ChatHourStatistics;

let chatHourStatisticsSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    userId: {
        type: Number,
        required: true,
    },
    moduleName: {
        type: String,
        required: true,
    },
    commandName: {
        type: String,
        required: true,
    },
    allCount: {
        type: Number,
        default: 0,
    },
    failCount: {
        type: Number,
        default: 0,
    },
    runtimeSum: {
        type: Number,
        default: 0,
    },
    runtimeMin: {
        type: Number,
        default: Infinity,
    },
    runtimeMax: {
        type: Number,
        default: 0,
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

chatHourStatisticsSchema.index({
    userId: 1,
    chatId: 1,
    moduleName: 1,
    commandName: 1,
    'date.year': 1,
    'date.month': 1,
    'date.day': 1,
    'date.hours': 1,
}, {unique: true});

chatHourStatisticsSchema.pre('save', function(next) {
    this.date.time = this.fullDate.getTime() || 0;
    next();
});

chatHourStatisticsSchema.virtual('fullDate')
    .get(function () {
       return new Date(this.date.year, this.date.month, this.date.day, this.date.hours);
    })
    .set(function (date) {
        if (!(date instanceof Date)) date = new Date(date);
        this.date.year = date.getFullYear();
        this.date.month = date.getMonth();
        this.date.day = date.getDate();
        this.date.hours = date.getHours();
        this.date.time = date.getTime();
    });

chatHourStatisticsSchema.query.byDate = function (date = new Date()) {
    if (!(date instanceof Date)) date = new Date(date);
    return this.find({
        'date.year': date.getFullYear(),
        'date.month': date.getMonth(),
        'date.day': date.getDate(),
        'date.hours': date.getHours(),
    })
};

chatHourStatisticsSchema.query.betweenDates = function (date1, date2 = new Date()) {
    if (!(date1 instanceof Date)) date1 = new Date(date1);
    if (!(date2 instanceof Date)) date2 = new Date(date2);
    if (date1.getTime() > date2.getTime()) [date1, date2] = [date2, date1];
    return this.find({
        'date.time': { $gte: date1.getTime(), $lte: date2.getTime() },
    })
};

/**
 *
 * @param {Date|Number} dateTime
 * @returns {Boolean}
 */
chatHourStatisticsSchema.methods.equalDate = function (dateTime) {
    let date = dateTime instanceof Date ? dateTime : new Date(dateTime);
    let hoursTime = 36e5;
    let time = date - this.fullDate;
    return time < hoursTime && time >= 0;
};

/**
 *
 * @param {Date|Number} dateTime
 * @returns {Boolean}
 */
chatHourStatisticsSchema.methods.equalDay = function (dateTime) {
    let date = dateTime instanceof Date ? dateTime : new Date(dateTime);
    let dayTime = 24 * 36e5;
    let time = date - this.fullDate;
    return time < dayTime && time >= 0;
};

/**
 *
 * @param {ChatHourStatistics|Object} doc
 * @return {ChatHourStatistics}
 */
chatHourStatisticsSchema.methods.setUp = function (doc) {
    this.allCount = doc.allCount;
    this.failCount = doc.failCount;
    this.runtimeSum = doc.runtimeSum;
    this.runtimeMin = doc.runtimeMin;
    this.runtimeMax = doc.runtimeMax;
    return this;
};

/**
 *
 * @param {ChatHourStatistics|Object} doc
 * @return {ChatHourStatistics}
 */
chatHourStatisticsSchema.methods.sumUp = function (doc) {
    this.allCount += doc.allCount;
    this.failCount += doc.failCount;
    this.runtimeSum += doc.runtimeSum;
    if (this.runtimeMin > doc.runtimeMin) this.runtimeMin = doc.runtimeMin;
    if (this.runtimeMax < doc.runtimeMax) this.runtimeMax = doc.runtimeMax;
    return this;
};

/**
 *
 * @param {ChatHourStatistics} doc
 * @return {Promise<ChatHourStatistics>}
 */
chatHourStatisticsSchema.methods.inc = function (doc) {
    if (this.equalDate(doc.fullDate)) {
        return Promise.resolve(this.sumUp(doc));
    } else {
        return this.saveOrUpdate().then(() => doc);
    }
};

/**
 *
 * @param {Number} time
 * @param {Boolean} fail
 * @return {ChatHourStatistics}
 */
chatHourStatisticsSchema.methods.setInfo = function (time, fail = false) {
    return this.sumUp({
        allCount: 1,
        failCount: fail ? 1 : 0,
        runtimeSum: time,
        runtimeMin: time,
        runtimeMax: time,
    });
};

/**
 *
 * @return {Promise.<ChatHourStatistics>}
 */
chatHourStatisticsSchema.methods.saveOrUpdate = function () {
    return ChatHourStatistics.find({
        chatId: this.chatId,
        userId: this.userId,
        moduleName: this.moduleName,
        commandName: this.commandName,
    })
        .byDate(this.fullDate)
        .findOne()
        .exec()
        .then(doc => {
            if (doc) return doc.sumUp(this).save();
            if (this.allCount + this.failCount > 0) return this.save();
            return Promise.resolve(this);
})
};

ChatHourStatistics = mongoose.model('ChatHourStatistics', chatHourStatisticsSchema);



module.exports = ChatHourStatistics;
