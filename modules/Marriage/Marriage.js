let mongoose = require('mongoose');

let MarriageSchema = mongoose.Schema({
    chatId: {
        type: Number,
        required: true,
    },
    userId1: {
        type: Number,
        required: true,
    },
    userId2: {
        type: Number,
        required: true,
    },
    time: {
        type: Number,
        default: Date.now,
    },

});

MarriageSchema.index({
    chatId: 1,
    userId1: 1,
}, {unique: true});

MarriageSchema.index({
    chatId: 1,
    userId2: 1,
}, {unique: true});

MarriageSchema.pre('save', function(next) {
    if (this.userId1 > this.userId2) {
        [ this.userId1, this.userId2 ] = [ this.userId2, this.userId1 ];
    }
    if (!this.time) this.time = Date.now();
    next();
});

let Marriage = mongoose.model('Marriage', MarriageSchema);

module.exports = Marriage;