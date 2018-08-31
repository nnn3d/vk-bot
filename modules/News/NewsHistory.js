let mongoose = require('mongoose');

let NewsHistorySchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    userId: {
        type: [Number],
    },
    channel: {
        type: String,
    },
    date: {
        type: Date,
        expires: '24h',
    },
    fromUser: {
        type: Number,
    },
    text: {
        type: String,
        required: true,
    }
});

NewsHistorySchema.index({
    chatId: 1,
    date: 1,
    channel: 1,
    userId: 1,
});

let NewsHistory = mongoose.model('NewsHistory', NewsHistorySchema);

module.exports = NewsHistory;
