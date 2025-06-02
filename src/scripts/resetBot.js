const mongoose = require('mongoose');
const Card = require('../models/Card');
const FusedCard = require('../models/FusedCard');
const UserCollection = require('../models/UserCollection');
const UserCredits = require('../models/UserCredits');
const User = require('../models/User');
const Trade = require('../models/Trade');
const Battle = require('../models/Battle');
const config = require('../config/config');
const { generateCardImage } = require('../utils/cardUtils');
const fs = require('fs').promises;
const path = require('path');

async function resetBot() {
    try {
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Confirm reset
        console.log('\n⚠️  WARNING: This will reset all bot data including:');
        console.log('  - All user collections');
        console.log('  - All user credits');
        console.log('  - All user levels and XP');
        console.log('  - All trades and battles');
        console.log('  - All cards (regular and fused)');
        console.log('\nThis action cannot be undone!');
        console.log('\nTo proceed, type "RESET" and press Enter:');

        // Wait for user confirmation
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const confirmation = await new Promise(resolve => {
            readline.question('', answer => {
                readline.close();
                resolve(answer);
            });
        });

        if (confirmation !== 'RESET') {
            console.log('Reset cancelled.');
            process.exit(0);
        }

        console.log('\nStarting system reset...');

        // Delete all collections
        console.log('Deleting all collections...');
        await Promise.all([
            UserCollection.deleteMany({}),
            UserCredits.deleteMany({}),
            User.deleteMany({}),
            Trade.deleteMany({}),
            Battle.deleteMany({}),
            Card.deleteMany({}),
            FusedCard.deleteMany({})
        ]);

        // Reset cards.json
        console.log('Resetting cards.json...');
        const cardsPath = path.join(__dirname, '../config/cards.json');
        const defaultCardsData = {
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            totalCards: 0,
            regularCards: 0,
            fusedCards: 0,
            cards: []
        };
        await fs.writeFile(cardsPath, JSON.stringify(defaultCardsData, null, 2));

        // Recreate base cards if cards.json exists in config
        const baseCardsPath = path.join(__dirname, '../config/baseCards.json');
        try {
            const baseCardsData = JSON.parse(await fs.readFile(baseCardsPath, 'utf8'));
            console.log('Found base cards, recreating...');

            const cardsToInsert = [];
            for (const card of baseCardsData.cards) {
                let imageUrl = card.imageUrl?.trim();
                
                // If image URL is blank, generate a new one
                if (!imageUrl) {
                    try {
                        imageUrl = await generateCardImage(card.name.trim());
                        console.log(`Generated image for card: ${card.name}`);
                    } catch (error) {
                        console.error(`Failed to generate image for card ${card.name}:`, error);
                        continue; // Skip this card if image generation fails
                    }
                }

                cardsToInsert.push({
                    name: card.name.trim(),
                    rarity: card.rarity.toLowerCase(),
                    imageUrl: imageUrl,
                    description: card.description.trim(),
                    set: card.set?.trim() || 'Base Set',
                    power: typeof card.power === 'number' ? card.power : 0
                });
            }

            // Insert cards in batches
            const batchSize = 10;
            for (let i = 0; i < cardsToInsert.length; i += batchSize) {
                const batch = cardsToInsert.slice(i, i + batchSize);
                await Card.insertMany(batch);
                console.log(`Inserted batch of ${batch.length} cards`);
            }

            // Update cards.json with the new cards
            const updatedCardsData = {
                version: '1.0.0',
                lastUpdated: new Date().toISOString(),
                totalCards: cardsToInsert.length,
                regularCards: cardsToInsert.length,
                fusedCards: 0,
                cards: cardsToInsert
            };
            await fs.writeFile(cardsPath, JSON.stringify(updatedCardsData, null, 2));
            console.log('Updated cards.json with new card data');

        } catch (error) {
            console.log('No base cards found or error loading them:', error.message);
        }

        console.log('\n✅ System reset complete!');
        console.log('The bot has been reset to its initial state.');
        console.log('You can now restart the bot to begin fresh.');

    } catch (error) {
        console.error('Error during reset:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

// Run the reset function
resetBot(); 