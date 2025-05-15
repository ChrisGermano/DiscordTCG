const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
    roundNumber: {
        type: Number,
        required: true
    },
    challengerPower: {
        type: Number,
        required: true
    },
    defenderPower: {
        type: Number,
        required: true
    },
    challengerEffects: [{
        type: String,
        enum: ['critical_hit', 'defense_boost', 'power_steal', 'double_power', 'shield', 'none']
    }],
    defenderEffects: [{
        type: String,
        enum: ['critical_hit', 'defense_boost', 'power_steal', 'double_power', 'shield', 'none']
    }],
    winner: {
        type: String,
        enum: ['challenger', 'defender', 'tie'],
        required: true
    }
});

const battleSchema = new mongoose.Schema({
    challengerId: {
        type: String,
        required: true
    },
    defenderId: {
        type: String,
        required: true
    },
    challengerCardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Card',
        required: true
    },
    defenderCardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Card',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    rounds: [roundSchema],
    currentRound: {
        type: Number,
        default: 1
    },
    challengerWins: {
        type: Number,
        default: 0
    },
    defenderWins: {
        type: Number,
        default: 0
    },
    winnerId: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 3600 // Automatically delete battles after 1 hour
    }
});

// Ensure users can't have multiple active battles
battleSchema.index({ challengerId: 1, status: 1 }, { 
    partialFilterExpression: { status: { $in: ['pending', 'in_progress'] } }
});
battleSchema.index({ defenderId: 1, status: 1 }, { 
    partialFilterExpression: { status: { $in: ['pending', 'in_progress'] } }
});

module.exports = mongoose.model('Battle', battleSchema); 