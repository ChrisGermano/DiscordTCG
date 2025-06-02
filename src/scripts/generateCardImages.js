const mongoose = require('mongoose');
const Card = require('../models/Card');
const { generateCardImage } = require('../utils/cardUtils');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function syncCardsToDatabase(cardsData) {
    console.log('Syncing cards to database...');
    let updated = 0;
    let inserted = 0;
    let errors = 0;

    for (const cardData of cardsData.cards) {
        try {
            // Try to find existing card by name
            const existingCard = await Card.findOne({ name: cardData.name });
            
            if (existingCard) {
                // Update existing card
                existingCard.imageUrl = cardData.imageUrl;
                existingCard.rarity = cardData.rarity;
                existingCard.description = cardData.description;
                existingCard.set = cardData.set;
                existingCard.power = cardData.power;
                await existingCard.save();
                updated++;
                console.log(`Updated card: ${cardData.name}`);
            } else {
                // Insert new card
                const newCard = new Card({
                    name: cardData.name,
                    imageUrl: cardData.imageUrl,
                    rarity: cardData.rarity,
                    description: cardData.description,
                    set: cardData.set,
                    power: cardData.power
                });
                await newCard.save();
                inserted++;
                console.log(`Inserted new card: ${cardData.name}`);
            }
        } catch (error) {
            console.error(`Error processing card ${cardData.name}:`, error);
            errors++;
        }
    }

    console.log('\nDatabase sync summary:');
    console.log(`Updated cards: ${updated}`);
    console.log(`Inserted cards: ${inserted}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total cards processed: ${cardsData.cards.length}`);
}

async function generateCardImages() {
    try {
        // Verify environment variables
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not set. Please check your .env file.');
        }

        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Load cards.json
        console.log('Loading cards.json...');
        const cardsPath = path.join(__dirname, '../config/cards.json');
        const cardsData = JSON.parse(await fs.readFile(cardsPath, 'utf8'));
        
        // Find cards that need images
        const cardsNeedingImages = cardsData.cards.filter(card => !card.imageUrl || card.imageUrl.trim() === '');
        console.log(`Found ${cardsNeedingImages.length} cards needing images`);

        // Generate images if needed
        if (cardsNeedingImages.length > 0) {
            console.log('\nGenerating images...');
            let successCount = 0;
            let failCount = 0;

            for (const card of cardsNeedingImages) {
                try {
                    console.log(`Generating image for: ${card.name}`);
                    const imageUrl = await generateCardImage(card.name.trim());
                    
                    // Update card in database
                    await Card.findOneAndUpdate(
                        { name: card.name },
                        { imageUrl: imageUrl },
                        { new: true }
                    );

                    // Update card in cards.json
                    const cardIndex = cardsData.cards.findIndex(c => c.name === card.name);
                    if (cardIndex !== -1) {
                        cardsData.cards[cardIndex].imageUrl = imageUrl;
                    }

                    successCount++;
                    console.log(`✅ Generated image for: ${card.name}`);
                } catch (error) {
                    console.error(`❌ Failed to generate image for ${card.name}:`, error.message);
                    failCount++;
                }
            }

            // Save updated cards.json
            console.log('\nSaving updated cards.json...');
            await fs.writeFile(cardsPath, JSON.stringify(cardsData, null, 2));

            // Print image generation summary
            console.log('\n=== Image Generation Summary ===');
            console.log(`Total cards processed: ${cardsNeedingImages.length}`);
            console.log(`Successfully generated: ${successCount}`);
            console.log(`Failed to generate: ${failCount}`);
            
            if (failCount > 0) {
                console.log('\n⚠️  Some cards failed to generate images. You may want to retry those cards.');
            }
        } else {
            console.log('No cards need image generation.');
        }

        // Always sync all cards to database
        console.log('\n=== Database Sync ===');
        await syncCardsToDatabase(cardsData);

    } catch (error) {
        console.error('Error during script execution:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the image generation
generateCardImages(); 