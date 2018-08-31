let mongoose = require('mongoose');

let defaultDate = () => {
    "use strict";
    let date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
};

let ChatCommandUsageSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    module: {
        type: String,
        required: true,
    },
    command: {
        type: String,
        required: true,
    },
    usages: {
        type: Number,
        default: 0,
    },
    date: {
        type: Date,
        default: defaultDate,
        expires: '1d',
    },
});

let ChatCommandUsage = mongoose.model('ChatCommandUsage', ChatCommandUsageSchema);

module.exports = ChatCommandUsage;