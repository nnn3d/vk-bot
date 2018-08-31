let mongoose = require('mongoose');

let AntiCaptchaBotChatsSchema = mongoose.Schema({
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

AntiCaptchaBotChatsSchema.index({
    selfId: 1,
    botId: 1,
    selfChatId: 1,
    botChatId: 1,
}, {unique: true});

let AntiCaptchaBotChats = mongoose.model('AntiCaptchaBotChats', AntiCaptchaBotChatsSchema);

module.exports = AntiCaptchaBotChats;