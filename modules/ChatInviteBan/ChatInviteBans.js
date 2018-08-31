let mongoose = require('mongoose');

let ChatInviteBansSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    ban: {
        type: Boolean,
        default: false,
    },
    canInvite: {
        type: Boolean,
        default: false,
    },
    date: {
        type: Date,
        default: () => new Date,
    }
});

ChatInviteBansSchema.index({
    chatId: 1,
}, {unique: true});

let ChatInviteBans = mongoose.model('ChatInviteBans', ChatInviteBansSchema);

module.exports = ChatInviteBans;