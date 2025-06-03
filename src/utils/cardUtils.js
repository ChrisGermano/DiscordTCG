const fetch = require('node-fetch');
const UserCollection = require('../models/UserCollection');
const Card = require('../models/Card');

const COMPOSITION_STYLES = [
    "Bird's Eye View",
    "Portrait Shot",
    "Full Body Shot"
];

const LIGHTING_STYLES = [
    "Dynamic Shadows",
    "Cinematic",
    "Ambient Occlusion"
];

/**
 * Generates a card image using the pixelateimage.org API
 * @param {string} cardName - The name of the card to generate an image for
 * @returns {Promise<string>} The URL of the generated image
 * @throws {Error} If the API request fails or no image URL is returned
 */
async function generateCardImage(cardName) {
    try {
        const randomComposition = COMPOSITION_STYLES[Math.floor(Math.random() * COMPOSITION_STYLES.length)];
        const randomLighting = LIGHTING_STYLES[Math.floor(Math.random() * LIGHTING_STYLES.length)];

        const response = await fetch('https://pixelateimage.org/api/coze-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: cardName + " with no text in image",
                aspectRatio: "1:1",
                pixelStyle: "Fantasy Pixel Art",
                colorPalette: "Vibrant",
                lightingStyle: randomLighting,
                compositionStyle: randomComposition
            })
        });

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.imageUrl) {
            throw new Error('No image URL in response');
        }

        return data.imageUrl;
    } catch (error) {
        console.error('Error generating card image:', error);
        throw error;
    }
}

/**
 * Add experience to a user, applying Xenithar's 1.5x multiplier if they have the card
 * @param {Object} user - The user document to add XP to
 * @param {number} amount - The base amount of XP to add
 * @returns {Promise<Object>} The XP gain result including any bonuses
 */
async function addExperience(user, amount) {
    // Check if user has Xenithar
    const userCollection = await UserCollection.findOne({ userId: user.userId })
        .populate({
            path: 'cards.cardId',
            refPath: 'cards.cardType'
        });

    let hasXenithar = false;
    if (userCollection) {
        const xenitharCard = await Card.findOne({ name: 'Xenithar the Core Cognizant' });
        if (xenitharCard) {
            hasXenithar = userCollection.cards.some(card => 
                card.cardId && 
                card.cardId._id.toString() === xenitharCard._id.toString() && 
                card.quantity > 0
            );
        }
    }

    // Apply Xenithar's 1.5x multiplier if they have it
    const xpToAdd = hasXenithar ? Math.floor(amount * 1.5) : amount;
    user.xp += xpToAdd;
    user.lastXpGain = new Date();
    
    // Check for level ups
    while (user.xp >= user.getXpForNextLevel()) {
        user.xp -= user.getXpForNextLevel();
        user.level += 1;
    }
    
    await user.save();
    return {
        newLevel: user.level,
        xpGained: xpToAdd,
        currentXp: user.xp,
        xpForNextLevel: user.getXpForNextLevel(),
        xenitharBonus: hasXenithar
    };
}

module.exports = {
    generateCardImage,
    addExperience
}; 