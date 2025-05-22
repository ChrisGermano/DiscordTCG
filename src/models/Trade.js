const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
    tradeId: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'completed', 'cancelled'],
        default: 'pending'
    },
    initiatorId: {
        type: String,
        required: true
    },
    targetId: {
        type: String,
        required: true
    },
    initiatorCards: [{
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
    targetCards: [{
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
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date,
    cancelledAt: Date,
    cancelledBy: String
});

tradeSchema.pre('save', function(next) {
    if (this.status === 'completed' && !this.completedAt) {
        this.completedAt = new Date();
    }
    if (this.status === 'cancelled' && !this.cancelledAt) {
        this.cancelledAt = new Date();
    }
    next();
});

const Trade = mongoose.model('Trade', tradeSchema);

module.exports = Trade; 