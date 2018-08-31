let mongoose = require('mongoose');

let NotesRemindSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    userId: {
        type: Number,
        required: true,
    },
    time: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
});

NotesRemindSchema.index({
    chatId: 1,
    userId: 1,
    name: 1,
}, { unique: true });

let NotesRemind = mongoose.model('NotesRemind', NotesRemindSchema);

module.exports = NotesRemind;