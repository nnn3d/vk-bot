let mongoose = require('mongoose');

let ChatCommunicationStatusSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
        unique: true,
    },
    status: {
        type: Boolean,
        default: true,
    },
});

let ChatCommunicationStatus = mongoose.model('ChatCommunicationStatus', ChatCommunicationStatusSchema);

module.exports = ChatCommunicationStatus;