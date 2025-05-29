const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord-api-types/v9');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const Card = require('../../models/Card');
const UserCollection = require('../../models/UserCollection');
const UserCredits = require('../../models/UserCredits');
const FusedCard = require('../../models/FusedCard');
const Trade = require('../../models/Trade');
const Battle = require('../../models/Battle');
const User = require('../../models/User');

async function generateCardImage(cardName) {
    try {
        const response = await fetch('https://pixelateimage.org/api/coze-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: cardName,
                aspectRatio: "1:1",
                pixelStyle: "Retro 8-bit Pixel Art",
                colorPalette: "Game Boy (Original)",
                compositionStyle: "Portrait Shot"
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

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('reset')
        .setDescription('Reset the entire TCG system (Admin only)'),

    async execute(interaction) {
        try {
            // Confirm with the user first
            await interaction.reply({
                content: '⚠️ **WARNING: This will reset the ENTIRE TCG system!**\n' +
                    'This will:\n' +
                    '• Delete all user collections\n' +
                    '• Reset all user currency to default\n' +
                    '• Delete all cards from the database\n' +
                    '• Delete all fused cards\n' +
                    '• Delete all trades and battles\n' +
                    '• Regenerate cards from config\n\n' +
                    'Are you sure you want to proceed? Reply with "yes" to confirm.',
                ephemeral: true
            });

            // Wait for confirmation
            const filter = m => m.author.id === interaction.user.id && m.content.toLowerCase() === 'yes';
            const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });

            collector.on('collect', async () => {
                await interaction.followUp({ content: 'Starting system reset...', ephemeral: true });

                try {
                    // Delete all cards
                    await Card.deleteMany({});

                    // Delete all fused cards
                    await FusedCard.deleteMany({});

                    // Delete all trades
                    await Trade.deleteMany({});

                    // Delete all battles
                    await Battle.deleteMany({});

                    // Reset all user collections
                    await UserCollection.deleteMany({});

                    // Reset all user XP and level
                    const users = await User.find({});
                    for (const user of users) {
                        user.xp = 0;
                        user.level = 1;
                        user.lastXpGain = null;
                        await user.save();
                    }

                    // Reset all user credits to default
                    await UserCredits.updateMany({}, {
                        $set: {
                            credits: 1000, // Default starting currency
                            lastEarnTime: null
                        }
                    });

                    // Read and regenerate cards from config
                    const cardsConfigPath = path.join(__dirname, '../../config/cards.json');
                    const rawCardsData = JSON.parse(await fs.readFile(cardsConfigPath, 'utf8'));
                    
                    // Get the cards array from the config
                    const cardsData = Array.isArray(rawCardsData.cards) ? rawCardsData.cards : [];

                    if (cardsData.length === 0) {
                        throw new Error('No cards found in the config file. Please check the card data format.');
                    }

                    // Validate and filter cards
                    const validCards = cardsData.filter(card => {
                        const isValid = card && 
                            typeof card.name === 'string' && card.name.trim() !== '' &&
                            typeof card.rarity === 'string' && ['common', 'uncommon', 'rare', 'legendary'].includes(card.rarity.toLowerCase()) &&
                            typeof card.imageUrl === 'string' &&
                            typeof card.description === 'string' && card.description.trim() !== '';
                        
                        if (!isValid) {
                            console.error('Invalid card data:', card);
                        }
                        return isValid;
                    });

                    if (validCards.length === 0) {
                        throw new Error('No valid cards found in the config file. Please check the card data format.');
                    }

                    // Insert all valid cards from config
                    const cardsToInsert = [];
                    for (const card of validCards) {
                        let imageUrl = card.imageUrl.trim();
                        
                        // If image URL is blank, generate a new one
                        if (!imageUrl) {
                            try {
                                imageUrl = await generateCardImage(card.name.trim());
                                console.log(`Generated image for card: ${card.name}`);
                            } catch (error) {
                                console.error(`Failed to generate image for card ${card.name}:`, error);
                                // Continue with blank image URL if generation fails
                            }
                        }

                        cardsToInsert.push({
                            name: card.name.trim(),
                            rarity: card.rarity.toLowerCase(),
                            imageUrl: imageUrl,
                            description: card.description.trim(),
                            set: card.set?.trim() || 'Base Set',
                            power: typeof card.power === 'number' ? card.power : 0,
                            special: Boolean(card.special)
                        });
                    }

                    // Insert cards in batches to avoid overwhelming the database
                    const batchSize = 10;
                    for (let i = 0; i < cardsToInsert.length; i += batchSize) {
                        const batch = cardsToInsert.slice(i, i + batchSize);
                        await Card.insertMany(batch);
                        console.log(`Inserted batch of ${batch.length} cards`);
                    }

                    await interaction.followUp({
                        content: '✅ System reset complete!\n' +
                            '• All user collections have been cleared\n' +
                            '• All user XP and levels have been reset\n' +
                            '• All user currency has been reset to 1000\n' +
                            '• All cards have been deleted and regenerated\n' +
                            '• All fused cards have been deleted\n' +
                            '• All trades and battles have been cleared\n' +
                            '• Generated new images for cards with blank URLs',
                        ephemeral: true
                    });
                } catch (error) {
                    console.error('Error during system reset:', error);
                    await interaction.followUp({
                        content: '❌ An error occurred during the system reset. Please check the console for details.',
                        ephemeral: true
                    });
                }
            });

            collector.on('end', async collected => {
                if (collected.size === 0) {
                    await interaction.followUp({
                        content: 'Reset cancelled - no confirmation received within 30 seconds.',
                        ephemeral: true
                    });
                }
            });
        } catch (error) {
            console.error('Error in reset command:', error);
            await interaction.reply({
                content: 'There was an error executing the reset command.',
                ephemeral: true
            });
        }
    }
}; 