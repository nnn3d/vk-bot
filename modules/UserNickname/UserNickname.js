let mongoose = require('mongoose');

let UserNicknameSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    userId: {
        type: Number,
        required: true,
    },
    nickname: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        default: () => new Date,
    },
});

UserNicknameSchema.index({
    chatId: 1,
    userId: 1,
    nickname: 1,
}, {unique: true});

let UserNickname = mongoose.model('UserNickname', UserNicknameSchema);

module.exports = UserNickname;