const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const User = require('../../models/User');
const UserCollection = require('../../models/UserCollection');
const UserCredits = require('../../models/UserCredits');
const Card = require('../../models/Card');
const config = require('../../config/config');
const { MessageEmbed } = require('discord.js');

const data = new SlashCommandSubcommandBuilder()
    .setName('profile')
    .setDescription('View your TCG profile');

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const userId = interaction.user.id;
        let user = await User.findOne({ userId });
        let collection = await UserCollection.findOne({ userId });
        let userCredits = await UserCredits.findOne({ userId });

        // Register new user if they don't exist
        if (!user) {
            user = new User({
                userId: userId,
                username: interaction.user.username
            });
            await user.save();
        }

        // Create collection if it doesn't exist
        if (!collection) {
            collection = new UserCollection({
                userId: userId,
                cards: []
            });
            await collection.save();
        }

        // Create credits if they don't exist
        if (!userCredits) {
            userCredits = new UserCredits({
                userId: userId,
                credits: 10 // Starting credits
            });
            await userCredits.save();
        }

        // Calculate XP progress
        const xpForNextLevel = user.getXpForNextLevel();
        const xpProgress = (user.xp / xpForNextLevel) * 100;
        const progressBar = createProgressBar(xpProgress);

        // Get collection stats
        const totalCards = collection ? collection.cards.reduce((sum, card) => sum + card.quantity, 0) : 0;
        const uniqueCards = collection ? collection.cards.length : 0;

        const rarityCounts = {
            common: 0,
            uncommon: 0,
            rare: 0,
            legendary: 0
        };

        const specialCounts = {
            common: 0,
            uncommon: 0,
            rare: 0,
            legendary: 0
        };

        for (const userCard of collection.cards) {
            const card = await Card.findById(userCard.cardId);
            if (card) {
                if (userCard.special) {
                    specialCounts[card.rarity] += userCard.quantity;
                } else {
                    rarityCounts[card.rarity] += userCard.quantity;
                }
            }
        }

        // Create embed
        const embed = new MessageEmbed()
            .setTitle(`${interaction.user.username}'s TCG Profile`)
            .setColor('#FFD700')
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Level', value: `${user.level}`, inline: true },
                { name: 'XP Progress', value: `${progressBar}\n${user.xp}/${xpForNextLevel} XP`, inline: false },
                { name: 'Total Cards', value: `${totalCards}`, inline: true },
                { name: 'Unique Cards', value: `${uniqueCards}`, inline: true },
                { name: 'Special Cards', value: `${specialCounts.common + specialCounts.uncommon + specialCounts.rare + specialCounts.legendary}`, inline: true },
                { name: 'Card Types', value: `Regular: ${rarityCounts.common + rarityCounts.uncommon + rarityCounts.rare + rarityCounts.legendary}\nFused: ${specialCounts.common + specialCounts.uncommon + specialCounts.rare + specialCounts.legendary}`, inline: true }
            );

        // Add rarity breakdown
        const rarityBreakdown = Object.entries(rarityCounts)
            .map(([rarity, count]) => `${rarity.charAt(0).toUpperCase() + rarity.slice(1)}: ${count}`)
            .join('\n');
        embed.addField('Cards by Rarity', rarityBreakdown || 'No cards yet');

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in /tcg profile command:', error);
        await interaction.editReply('There was an error fetching your profile. Please try again later.');
    }
}

function createProgressBar(progress) {
    const totalBlocks = 10;
    const filledBlocks = Math.floor((progress / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    
    // Use different block characters for better visual appearance
    const filledChar = '█';
    const emptyChar = '░';
    
    return `[${filledChar.repeat(filledBlocks)}${emptyChar.repeat(emptyBlocks)}] ${Math.round(progress)}%`;
}

module.exports = {
    data,
    execute
}; 