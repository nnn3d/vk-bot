let mongoose = require('mongoose');

let UserCommunicationCountSchema = mongoose.Schema({
    userId: {
        type: Number,
        required: true,
    },
    chatId: {
        type: Number,
        required: true,
    },
    count: {
        type: Number,
        default: 0,
    },
    lastAttempt: {
        type: Number,
        default: 0,
    },
    resolve: {
        type: Boolean,
        default: false,
    },
    ban: {
        type: Boolean,
        default: false,
    },
});

UserCommunicationCountSchema.index({
    userId: 1,
    chatId: 1,
}, {unique: true});

let UserCommunicationCount = mongoose.model('UserCommunicationCount', UserCommunicationCountSchema);

module.exports = UserCommunicationCount;