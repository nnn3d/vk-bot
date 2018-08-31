let mongoose = require('mongoose');

let ChatVipStatusSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
        unique: true,
    },
    trial: {
        type: Boolean,
        default: false,
    },
    time: {
        type: Number,
        default: Date.now,
    },

});

let ChatVipStatus = mongoose.model('ChatVipStatus', ChatVipStatusSchema);

module.exports = ChatVipStatus;