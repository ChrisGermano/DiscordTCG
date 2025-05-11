const mongoose = require('mongoose');
const config = require('../config/config');

const userCreditsSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    credits: {
        type: Number,
        default: config.defaultCredits
    },
    lastWaterDrink: {
        type: Date,
        default: null
    }
});

module.exports = mongoose.model('UserCredits', userCreditsSchema); 