let mongoose = require('mongoose');

let GroupsChatsSchema = mongoose.Schema({
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

GroupsChatsSchema.index({
    selfId: 1,
    botId: 1,
    selfChatId: 1,
    botChatId: 1,
}, {unique: true});

let GroupsChats = mongoose.model('GroupsChats', GroupsChatsSchema);

module.exports = GroupsChats;