const mongoose = require('mongoose');
const { addExperience } = require('../utils/cardUtils');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    lastDaily: { type: Date, default: null },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    lastXpGain: { type: Date, default: Date.now }
});

// Calculate XP needed for next level
userSchema.methods.getXpForNextLevel = function() {
    return Math.floor(50 * Math.pow(1.15, this.level - 1));
};

// Add XP and handle level ups
userSchema.methods.addXp = async function(amount) {
    return addExperience(this, amount);
};

module.exports = mongoose.model('User', userSchema); 