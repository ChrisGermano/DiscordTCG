const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord-api-types/v9');
const fs = require('fs').promises;
const path = require('path');
const Card = require('../../models/Card');
const UserCollection = require('../../models/UserCollection');
const UserCredits = require('../../models/UserCredits');
const FusedCard = require('../../models/FusedCard');
const Trade = require('../../models/Trade');
const Battle = require('../../models/Battle');
const User = require('../../models/User');

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
                    console.log('Deleted all cards');

                    // Delete all fused cards
                    await FusedCard.deleteMany({});
                    console.log('Deleted all fused cards');

                    // Delete all trades
                    await Trade.deleteMany({});
                    console.log('Deleted all trades');

                    // Delete all battles
                    await Battle.deleteMany({});
                    console.log('Deleted all battles');

                    // Reset all user collections
                    await UserCollection.deleteMany({});
                    console.log('Deleted all user collections');

                    // Reset all user XP and level
                    const users = await User.find({});
                    for (const user of users) {
                        user.xp = 0;
                        user.level = 1;
                        user.lastXpGain = null;
                        await user.save();
                    }
                    console.log('Reset all user XP and levels');

                    // Reset all user credits to default
                    await UserCredits.updateMany({}, {
                        $set: {
                            credits: 1000, // Default starting currency
                            lastEarnTime: null
                        }
                    });
                    console.log('Reset all user currency to default');

                    // Read and regenerate cards from config
                    const cardsConfigPath = path.join(__dirname, '../../config/cards.json');
                    const rawCardsData = JSON.parse(await fs.readFile(cardsConfigPath, 'utf8'));
                    
                    // Get the cards array from the config
                    const cardsData = Array.isArray(rawCardsData.cards) ? rawCardsData.cards : [];
                    console.log(`Loaded ${cardsData.length} cards from config`);

                    if (cardsData.length === 0) {
                        throw new Error('No cards found in the config file. Please check the card data format.');
                    }

                    // Validate and filter cards
                    const validCards = cardsData.filter(card => {
                        const isValid = card && 
                            typeof card.name === 'string' && card.name.trim() !== '' &&
                            typeof card.rarity === 'string' && ['common', 'uncommon', 'rare', 'legendary'].includes(card.rarity.toLowerCase()) &&
                            typeof card.imageUrl === 'string' && card.imageUrl.trim() !== '' &&
                            typeof card.description === 'string' && card.description.trim() !== '';
                        
                        if (!isValid) {
                            console.error('Invalid card data:', card);
                        }
                        return isValid;
                    });

                    if (validCards.length === 0) {
                        throw new Error('No valid cards found in the config file. Please check the card data format.');
                    }

                    console.log(`Found ${validCards.length} valid cards out of ${cardsData.length} total cards`);

                    // Insert all valid cards from config
                    const cardsToInsert = validCards.map(card => ({
                        name: card.name.trim(),
                        rarity: card.rarity.toLowerCase(),
                        imageUrl: card.imageUrl.trim(),
                        description: card.description.trim(),
                        set: card.set?.trim() || 'Base Set',
                        power: typeof card.power === 'number' ? card.power : 0,
                        special: Boolean(card.special)
                    }));

                    await Card.insertMany(cardsToInsert);
                    console.log(`Successfully inserted ${cardsToInsert.length} cards into the database`);

                    await interaction.followUp({
                        content: '✅ System reset complete!\n' +
                            '• All user collections have been cleared\n' +
                            '• All user XP and levels have been reset\n' +
                            '• All user currency has been reset to 1000\n' +
                            '• All cards have been deleted and regenerated\n' +
                            '• All fused cards have been deleted\n' +
                            '• All trades and battles have been cleared',
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