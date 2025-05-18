const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    rarity: {
        type: String,
        enum: ['common', 'uncommon', 'rare', 'legendary', 'fused'],
        required: true
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
        required: true
    },
    special: {
        type: Boolean,
        default: null
    },
    power: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('Card', cardSchema); 