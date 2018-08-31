let mongoose = require('mongoose');

let defaultDate = () => {
    "use strict";
    let date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
};

let ChatInviteDayStatSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    symbols: {
        type: Number,
        default: 0,
    },
    messages: {
        type: Number,
        default: 0,
    },
    date: {
        type: Date,
        default: defaultDate,
        expires: '1d',
    },
});

let ChatInviteDayStat = mongoose.model('ChatInviteDayStat', ChatInviteDayStatSchema);

module.exports = ChatInviteDayStat;