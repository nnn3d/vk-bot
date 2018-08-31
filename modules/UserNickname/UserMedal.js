let mongoose = require('mongoose');

let UserMedalSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    userId: {
        type: Number,
        required: true,
    },
    medal: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        default: () => new Date,
    },
});

UserMedalSchema.index({
    chatId: 1,
    userId: 1,
    medal: 1,
}, {unique: true});

let UserMedal = mongoose.model('UserMedal', UserMedalSchema);

module.exports = UserMedal;