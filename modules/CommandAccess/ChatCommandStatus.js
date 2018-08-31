let mongoose = require('mongoose');

let ChatCommandStatusSchema = mongoose.Schema({
    chatId: {
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
    status: {
        type: Number,
        required: true,
        get: v => Math.floor(v),
        set: v => Math.floor(v)
    }
});

ChatCommandStatusSchema.index({
    chatId: 1,
    moduleName: 1,
    commandName: 1,
}, {unique: true});

let ChatCommandStatus = mongoose.model('ChatCommandStatus', ChatCommandStatusSchema);

module.exports = ChatCommandStatus;