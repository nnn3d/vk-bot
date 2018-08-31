let mongoose = require('mongoose');

let SimplePayInfoSchema = mongoose.Schema({
    payId: {
        type: Number,
        required: true,
        unique: true,
    },
    chatId: {
        type: Number,
        required: true,
    },
    userId: {
        type: Number,
        required: true,
    },
    amount: {
        type: Number,
        default: 0,
    },
    complete: {
        type: Boolean,
        default: false,
    },
    date: {
        type: Date,
        default: () => new Date,
    },
});

let SimplePayInfo = mongoose.model('SimplePayInfo', SimplePayInfoSchema);

module.exports = SimplePayInfo;
