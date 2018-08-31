let mongoose = require('mongoose');

let ChatUserStatusSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    userId: {
        type: Number,
        required: true,
    },
    status: {
        type: Number,
        default: 0,
        get: v => Math.round(v),
        set: v => Math.round(v)
    },
    autoKick: {
        type: Boolean,
        default: false,
    },
    ignore: {
        type: Boolean,
        default: false,
    },
});

ChatUserStatusSchema.index({
    chatId: 1,
    userId: 1,
}, {unique: true});

let ChatUserStatus = mongoose.model('ChatUserStatus', ChatUserStatusSchema);

module.exports = ChatUserStatus;