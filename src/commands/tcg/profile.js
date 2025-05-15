const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const UserCollection = require('../../models/UserCollection');
const UserCredits = require('../../models/UserCredits');
const Card = require('../../models/Card');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('profile')
    .setDescription('View your card collection profile');

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const userCollection = await UserCollection.findOne({ userId: interaction.user.id });
        const userCredits = await UserCredits.findOne({ userId: interaction.user.id });

        if (!userCollection || !userCredits) {
            await interaction.editReply('You don\'t have a collection yet! Use /tcg earn to get started.');
            return;
        }

        const totalCards = userCollection.cards.reduce((sum, card) => sum + card.quantity, 0);
        const uniqueCards = userCollection.cards.length;

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

        for (const userCard of userCollection.cards) {
            const card = await Card.findById(userCard.cardId);
            if (card) {
                if (userCard.special) {
                    specialCounts[card.rarity] += userCard.quantity;
                } else {
                    rarityCounts[card.rarity] += userCard.quantity;
                }
            }
        }

        const response = [
            `**${interaction.user.username}'s Collection Profile**`,
            `\n**Credits:** ${userCredits.credits} ${config.currencyName}`,
            `\n**Collection Stats:**`,
            `Total Cards: ${totalCards}`,
            `Unique Cards: ${uniqueCards}`,
            `\n**Card Breakdown:**`,
            `Common: ${rarityCounts.common} (${specialCounts.common} special)`,
            `Uncommon: ${rarityCounts.uncommon} (${specialCounts.uncommon} special)`,
            `Rare: ${rarityCounts.rare} (${specialCounts.rare} special)`,
            `Legendary: ${rarityCounts.legendary} (${specialCounts.legendary} special)`
        ].join('\n');

        await interaction.editReply(response);

    } catch (error) {
        console.error('Error in /tcg profile command:', error);
        await interaction.editReply('There was an error fetching your profile. Please try again later.');
    }
}

module.exports = {
    data,
    execute
}; 