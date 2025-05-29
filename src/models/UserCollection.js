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
            refPath: 'cards.cardType',
            required: true
        },
        cardType: {
            type: String,
            required: true,
            enum: ['Card', 'FusedCard']
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

// Add a compound index for efficient card lookups
userCollectionSchema.index({ userId: 1, 'cards.cardId': 1, 'cards.cardType': 1 }, { unique: true });

module.exports = mongoose.model('UserCollection', userCollectionSchema); 