const fetch = require('node-fetch');
const UserCollection = require('../models/UserCollection');
const { Card, CARD_TYPES } = require('../models/Card');
const config = require('../config/config');

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

/**
 * Get autocomplete suggestions for card names from a user's collection
 * @param {string} userId - The Discord user ID
 * @param {string} focusedValue - The current input value to match against
 * @param {Object} options - Additional options for filtering
 * @param {boolean} options.includeSpecial - Whether to include special cards (default: true)
 * @param {boolean} options.includeFused - Whether to include fused cards (default: true)
 * @param {string[]} options.rarities - Array of rarities to include (default: all)
 * @param {string[]} options.types - Array of card types to include (default: all)
 * @returns {Promise<Array<{name: string, value: string}>>} Array of matching card suggestions
 */
async function getCardAutocompleteSuggestions(userId, focusedValue, options = {}) {
    try {
        const {
            includeSpecial = true,
            includeFused = true,
            rarities = [],
            types = []
        } = options;

        // Get user's collection
        const userCollection = await UserCollection.findOne({ userId })
            .populate({
                path: 'cards.cardId',
                refPath: 'cards.cardType'
            });

        if (!userCollection) {
            return [];
        }

        const focusedValueLower = focusedValue.toLowerCase();

        // Filter cards based on the focused value and options
        const matchingCards = userCollection.cards
            .filter(card => {
                if (!card.cardId || !card.cardId.name) return false;
                
                // Check rarity filter
                if (rarities.length > 0 && !rarities.includes(card.cardId.rarity)) {
                    return false;
                }
                
                // Check type filter
                if (types.length > 0 && !types.includes(card.cardId.type)) {
                    return false;
                }
                
                // Check if it's a special card and if we should include them
                if (card.special && !includeSpecial) {
                    return false;
                }
                
                // Check if it's a fused card and if we should include them
                if (card.cardType === 'FusedCard' && !includeFused) {
                    return false;
                }
                
                // Check name match
                const cardName = card.cardId.name.toLowerCase();
                const specialName = `${config.specialPrefix} ${cardName}`.toLowerCase();
                
                return cardName.includes(focusedValueLower) || 
                       (card.special && specialName.includes(focusedValueLower));
            })
            .map(card => ({
                name: card.special ? `${config.specialPrefix} ${card.cardId.name}` : card.cardId.name,
                value: card.special ? `${config.specialPrefix} ${card.cardId.name}` : card.cardId.name
            }))
            // Remove duplicates
            .filter((card, index, self) => 
                index === self.findIndex(c => c.value === card.value)
            )
            // Sort alphabetically
            .sort((a, b) => a.name.localeCompare(b.name))
            // Limit to 25 choices (Discord's limit)
            .slice(0, 25);

        return matchingCards;
    } catch (error) {
        console.error('Error in getCardAutocompleteSuggestions:', error);
        return [];
    }
}

module.exports = {
    generateCardImage,
    addExperience,
    getCardAutocompleteSuggestions
}; 