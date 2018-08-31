let mongoose = require('mongoose');

let AutoInviteChatsSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    botId: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: () => new Date,
        expired: '1d',
    }
});

AutoInviteChatsSchema.index({
    chatId: 1,
    botId: 1,
}, {unique: true});

let AutoInviteChats = mongoose.model('AutoInviteChats', AutoInviteChatsSchema);

module.exports = AutoInviteChats;