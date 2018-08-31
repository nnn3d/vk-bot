let mongoose = require('mongoose');

let ChatStatusNamesSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    status: {
        type: Number,
        required: true,
        default: 0,
        get: v => Math.floor(v),
        set: v => Math.floor(v)
    },
    name: {
        type: String,
        required: true,
    }
});

ChatStatusNamesSchema.index({
    chatId: 1,
    status: 1,
}, {unique: true});

let ChatStatusNames = mongoose.model('ChatStatusNames', ChatStatusNamesSchema);

module.exports = ChatStatusNames;