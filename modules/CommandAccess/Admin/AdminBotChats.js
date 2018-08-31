let mongoose = require('mongoose');

let AdminBotChatsSchema = mongoose.Schema({
    selfId: {
        type: Number,
        required: true,
    },
    botId: {
        type: Number,
        required: true,
    },
    selfChatId: {
        type: Number,
        required: true,
    },
    botChatId: {
        type: Number,
        required: true,
    },
});

AdminBotChatsSchema.index({
    selfId: 1,
    botId: 1,
    selfChatId: 1,
    botChatId: 1,
}, {unique: true});

let AdminBotChats = mongoose.model('AdminBotChats', AdminBotChatsSchema);

module.exports = AdminBotChats;