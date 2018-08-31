let mongoose = require('mongoose');

let NotesChatSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    text: {
        type: String,
        required: true,
    },
});

NotesChatSchema.index({
    chatId: 1,
    handlerId: 1,
    name: 1,
}, {unique: true});

let NotesChat = mongoose.model('NotesChat', NotesChatSchema);

module.exports = NotesChat;