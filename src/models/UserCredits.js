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
        required: true,
        default: 0
    },
    lastEarnTime: {
        type: Date,
        default: null
    }
});

module.exports = mongoose.model('UserCredits', userCreditsSchema); 