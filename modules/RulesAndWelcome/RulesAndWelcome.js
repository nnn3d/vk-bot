let mongoose = require('mongoose');

let RulesAndWelcomeSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    welcome: {
        type: String,
        default: "",
    },
    rules: {
        type: String,
        default: "",
    }
});

RulesAndWelcomeSchema.index({
    chatId: 1,
}, {unique: true});

let RulesAndWelcome = mongoose.model('RulesAndWelcome', RulesAndWelcomeSchema);

module.exports = RulesAndWelcome;