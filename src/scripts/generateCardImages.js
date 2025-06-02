const mongoose = require('mongoose');
const Card = require('../models/Card');
const { generateCardImage } = require('../utils/cardUtils');
const fs = require('fs').promises;
const path = require('path');

async function generateCardImages() {
    try {
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

        if (cardsNeedingImages.length === 0) {
            console.log('No cards need image generation. Exiting...');
            return;
        }

        // Generate images and update database
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

        // Print summary
        console.log('\n=== Image Generation Summary ===');
        console.log(`Total cards processed: ${cardsNeedingImages.length}`);
        console.log(`Successfully generated: ${successCount}`);
        console.log(`Failed to generate: ${failCount}`);
        
        if (failCount > 0) {
            console.log('\n⚠️  Some cards failed to generate images. You may want to retry those cards.');
        }

    } catch (error) {
        console.error('Error during image generation:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

// Run the image generation
generateCardImages(); 