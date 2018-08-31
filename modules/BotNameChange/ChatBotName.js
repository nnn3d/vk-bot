let mongoose = require('mongoose');

let chatBotNameSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    botName: {
        type: String,
        required: true,
    }
});

let ChatBotName = mongoose.model('ChatBotName', chatBotNameSchema);

module.exports = ChatBotName;