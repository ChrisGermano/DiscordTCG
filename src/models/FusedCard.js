const mongoose = require('mongoose');
const Card = require('./Card');

const fusedCardSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    rarity: {
        type: String,
        required: true,
        enum: ['fused']
    },
    imageUrl: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    set: {
        type: String,
        required: true,
        default: 'Fusion'
    },
    power: {
        type: Number,
        required: true
    },
    fusedBy: {
        type: String,
        required: true
    },
    parentCards: [{
        cardId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Card',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        }
    }],
    special: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

fusedCardSchema.pre('save', function(next) {
    if (this.parentCards.length !== 2 || this.rarity !== 'fused') {
        next(new Error('Fused cards must have exactly 2 parent cards and rarity must be "fused"'));
    }
    next();
});

const FusedCard = mongoose.model('FusedCard', fusedCardSchema);

module.exports = FusedCard; 