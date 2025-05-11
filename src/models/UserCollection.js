const mongoose = require('mongoose');

const userCollectionSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    cards: [{
        cardId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Card',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            default: 1
        },
        special: {
            type: Boolean,
            default: false
        }
    }]
});

module.exports = mongoose.model('UserCollection', userCollectionSchema); 