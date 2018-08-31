let mongoose = require('mongoose');

let YandexMoneyInfoSchema = mongoose.Schema({
    walletId: {
        type: Number,
        required: true,
        unique: true,
    },
    from: {
        type: String,
        default: '',
    },

});

let YandexMoneyInfo = mongoose.model('YandexMoneyInfo', YandexMoneyInfoSchema);

module.exports = YandexMoneyInfo;