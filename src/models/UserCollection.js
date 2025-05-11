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
            default: 1
        },
        VFEC: {
            type: Boolean,
            default: null
        }
    }]
});

module.exports = mongoose.model('UserCollection', userCollectionSchema); 