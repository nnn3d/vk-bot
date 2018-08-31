let mongoose = require('mongoose');

let NotesListSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    userId: {
        type: [Number],
    },
});

NotesListSchema.index({
    chatId: 1,
    userId: 1,
}, {});

let NotesList = mongoose.model('NotesList', NotesListSchema);

module.exports = NotesList;