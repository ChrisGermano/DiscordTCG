const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const UserCollection = require('../../models/UserCollection');
const Card = require('../../models/Card');
const FusedCard = require('../../models/FusedCard');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('showcollection')
    .setDescription('Display your card collection');

async function execute(interaction) {
    await interaction.deferReply();

    const userId = interaction.user.id;

    try {
        const userCollection = await UserCollection.findOne({ userId: userId })
            .populate({
                path: 'cards.cardId',
                refPath: 'cards.cardType'
            });

        if (!userCollection || userCollection.cards.length === 0) {
            return interaction.editReply(`${interaction.user.username} doesn't have any cards in their collection yet!`);
        }

        // Group cards by rarity
        const cardsByRarity = {};
        userCollection.cards.forEach(card => {
            if (!card.cardId) return; // Skip invalid cards
            
            const rarity = card.cardId.rarity;
            if (!cardsByRarity[rarity]) {
                cardsByRarity[rarity] = [];
            }
            cardsByRarity[rarity].push({
                name: card.cardId.name,
                quantity: card.quantity,
                special: card.special,
                cardType: card.cardType
            });
        });

        // Create embed fields for each rarity
        const fields = [];
        for (const [rarity, cards] of Object.entries(cardsByRarity)) {
            const cardList = cards
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(card => {
                    const special = card.special ? '🌟 ' : '';
                    const fused = card.cardType === 'FusedCard' ? '🔮 ' : '';
                    return `${special}${fused}${card.name} (${card.quantity})`;
                })
                .join('\n');

            fields.push({
                name: `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Cards`,
                value: cardList || 'No cards of this rarity',
                inline: false
            });
        }

        const embed = new MessageEmbed()
            .setColor('#FFD700')
            .setTitle(`${interaction.user.username}'s Collection`)
            .setDescription('Here are all the cards in your collection:')
            .setTimestamp();

        fields.forEach(field => {
            embed.addField(field.name, field.value);
        });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in showcollection command:', error);
        await interaction.editReply('An error occurred while fetching your collection.');
    }
}

module.exports = { data, execute }; 