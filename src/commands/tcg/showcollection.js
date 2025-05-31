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

            // Create a unique key for each card that includes its special status
            const cardKey = `${card.cardId.name}-${card.special ? 'special' : 'regular'}`;
            
            // Check if we already have this exact card (including special status)
            const existingCardIndex = cardsByRarity[rarity].findIndex(c => 
                c.name === card.cardId.name && c.special === card.special
            );

            if (existingCardIndex !== -1) {
                // Update quantity of existing card
                cardsByRarity[rarity][existingCardIndex].quantity += card.quantity;
            } else {
                // Add new card entry
                cardsByRarity[rarity].push({
                    name: card.cardId.name,
                    quantity: card.quantity,
                    special: card.special,
                    cardType: card.cardType
                });
            }
        });

        // Create embed fields for each rarity
        const fields = [];
        for (const [rarity, cards] of Object.entries(cardsByRarity)) {
            const cardList = cards
                .sort((a, b) => {
                    // First sort by name
                    const nameCompare = a.name.localeCompare(b.name);
                    if (nameCompare !== 0) return nameCompare;
                    // Then sort by special status (non-special first)
                    return a.special ? 1 : -1;
                })
                .map(card => {
                    const special = card.special ? `${config.specialPrefix} ` : '';
                    const fused = card.cardType === 'FusedCard' ? '🔮 ' : '';
                    const rarityIndicator = card.special ? '✨ ' : ''; // Add sparkle for special cards
                    return `${rarityIndicator}${special}${fused}${card.name} (${card.quantity})`;
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