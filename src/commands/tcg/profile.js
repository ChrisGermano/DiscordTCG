const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const User = require('../../models/User');
const UserCollection = require('../../models/UserCollection');
const UserCredits = require('../../models/UserCredits');
const Card = require('../../models/Card');
const config = require('../../config/config');
const { MessageEmbed } = require('discord.js');

const data = new SlashCommandSubcommandBuilder()
    .setName('profile')
    .setDescription('View your TCG profile')
    .addUserOption(option =>
        option.setName('user')
            .setDescription('View another user\'s profile (optional)')
            .setRequired(false));

function createProgressBar(progress) {
    const filled = Math.round(progress / 10);
    const empty = 10 - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${Math.round(progress)}%`;
}

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        // Get target user (either mentioned user or command user)
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;

        let user = await User.findOne({ userId });
        let collection = await UserCollection.findOne({ userId })
            .populate({
                path: 'cards.cardId',
                refPath: 'cards.cardType'
            });
        let userCredits = await UserCredits.findOne({ userId });

        // Register new user if they don't exist
        if (!user) {
            user = new User({
                userId: userId,
                username: targetUser.username
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

        // Get rarity breakdown
        const rarityCounts = {};
        if (collection && collection.cards.length > 0) {
            collection.cards.forEach(card => {
                if (card.cardId && card.cardId.rarity) {
                    const rarity = card.cardId.rarity;
                    rarityCounts[rarity] = (rarityCounts[rarity] || 0) + card.quantity;
                }
            });
        }

        const rarityBreakdown = Object.entries(rarityCounts)
            .map(([rarity, count]) => {
                const emoji = {
                    common: '⚪',
                    uncommon: '🟢',
                    rare: '🔵',
                    legendary: '🟣',
                    fused: '✨'
                }[rarity] || '⚪';
                return `${emoji} ${rarity.charAt(0).toUpperCase() + rarity.slice(1)}: ${count}`;
            })
            .join('\n');

        const embed = new MessageEmbed()
            .setColor('#FFD700')
            .setTitle(`${targetUser.username}'s TCG Profile`)
            .setDescription(`Level ${user.level} Collector`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, format: 'png', size: 256 }))
            .addFields(
                { name: 'Experience', value: `${progressBar}\n${user.xp}/${xpForNextLevel} XP`, inline: false },
                { name: 'Currency', value: `${userCredits.credits} ${config.currencyName}`, inline: true },
                { name: 'Total Cards', value: `${totalCards}`, inline: true },
                { name: 'Unique Cards', value: `${uniqueCards}`, inline: true },
                { name: 'Cards by Rarity', value: rarityBreakdown || 'No cards yet', inline: false }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], ephemeral: true });

    } catch (error) {
        console.error('Error in /tcg profile command:', error);
        await interaction.editReply({ 
            content: 'There was an error fetching the profile. Please try again later.',
            ephemeral: true 
        });
    }
}

module.exports = {
    data,
    execute
}; 