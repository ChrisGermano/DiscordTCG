const fs = require('fs').promises;
const path = require('path');
const { Card } = require('../models/Card');
const FusedCard = require('../models/FusedCard');

/**
 * Exports all cards and fused cards from the database to cards.json
 * @returns {Promise<{success: boolean, message: string, stats?: {totalCards: number, totalFusedCards: number}}>}
 */
async function exportCardsToJson() {
    try {
        // Get all regular cards
        const cards = await Card.find({}).lean();
        console.log(`Found ${cards.length} regular cards in database`);

        // Get all fused cards
        const fusedCards = await FusedCard.find({}).lean();
        console.log(`Found ${fusedCards.length} fused cards in database`);

        // Transform cards to match the expected format
        const transformedCards = cards.map(card => ({
            name: card.name,
            rarity: card.rarity,
            imageUrl: card.imageUrl || '', // Ensure empty string if no image
            description: card.description,
            set: card.set || 'Base Set',
            power: card.power || 0,
            special: card.special || false
        }));

        // Transform fused cards to match the expected format
        const transformedFusedCards = fusedCards.map(card => ({
            name: card.name,
            rarity: 'fused', // All fused cards have 'fused' rarity
            imageUrl: card.imageUrl || '',
            description: card.description,
            set: card.set || 'Fused Set',
            power: card.power || 0,
            special: card.special || false,
            components: card.components || [], // Include the components used to create this card
            isFused: true // Mark as fused card
        }));

        // Combine both card types
        const allCards = [...transformedCards, ...transformedFusedCards];

        // Create the final JSON structure
        const cardData = {
            version: '1.0',
            lastUpdated: new Date().toISOString(),
            totalCards: allCards.length,
            regularCards: transformedCards.length,
            fusedCards: transformedFusedCards.length,
            cards: allCards
        };

        // Get the path to cards.json
        const cardsConfigPath = path.join(__dirname, '../../config/cards.json');

        // Create backup of existing file if it exists
        try {
            const existingData = await fs.readFile(cardsConfigPath, 'utf8');
            const backupPath = `${cardsConfigPath}.backup-${Date.now()}`;
            await fs.writeFile(backupPath, existingData);
            console.log(`Created backup at ${backupPath}`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn('Could not create backup:', error.message);
            }
        }

        // Write the new data
        await fs.writeFile(
            cardsConfigPath,
            JSON.stringify(cardData, null, 2),
            'utf8'
        );

        return {
            success: true,
            message: `Successfully exported ${allCards.length} cards to cards.json`,
            stats: {
                totalCards: allCards.length,
                totalFusedCards: transformedFusedCards.length,
                regularCards: transformedCards.length
            }
        };

    } catch (error) {
        console.error('Error exporting cards:', error);
        return {
            success: false,
            message: `Failed to export cards: ${error.message}`
        };
    }
}

/**
 * Command-line interface for the export function
 * This allows running the export directly from the command line
 */
async function main() {
    if (require.main === module) {
        console.log('Starting card export...');
        const result = await exportCardsToJson();
        console.log(result.message);
        if (result.stats) {
            console.log('\nExport Statistics:');
            console.log(`Total Cards: ${result.stats.totalCards}`);
            console.log(`Regular Cards: ${result.stats.regularCards}`);
            console.log(`Fused Cards: ${result.stats.totalFusedCards}`);
        }
        process.exit(result.success ? 0 : 1);
    }
}

// Run the main function if this file is executed directly
main();

module.exports = {
    exportCardsToJson
}; 