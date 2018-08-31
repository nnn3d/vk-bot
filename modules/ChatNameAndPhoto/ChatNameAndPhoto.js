let mongoose = require('mongoose');

let ChatNameAndPhotoSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    chatName: {
        type: String,
        default: "",
    },
    chatPhoto: {
        type: String,
        default: "",
    },
    fileType: {
        type: Boolean,
        default: false,
    },
    chatPin: {
        type: Number,
    },
});

ChatNameAndPhotoSchema.index({
    chatId: 1,
}, {unique: true});

let ChatNameAndPhoto = mongoose.model('ChatNameAndPhoto', ChatNameAndPhotoSchema);

module.exports = ChatNameAndPhoto;