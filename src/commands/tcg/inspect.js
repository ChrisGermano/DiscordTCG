const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const Card = require('../../models/Card');
const UserCollection = require('../../models/UserCollection');
const FusedCard = require('../../models/FusedCard');
const { MessageEmbed } = require('discord.js');

const data = new SlashCommandSubcommandBuilder()
    .setName('inspect')
    .setDescription('Inspect a card from your collection in detail')
    .addStringOption(option =>
        option.setName('card')
            .setDescription('The name of the card to inspect')
            .setRequired(true));

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const cardName = interaction.options.getString('card');
        const userId = interaction.user.id;

        // First find the user's collection with basic population
        const userCollection = await UserCollection.findOne({ userId })
            .populate({
                path: 'cards.cardId',
                refPath: 'cards.cardType'
            });

        if (!userCollection) {
            return await interaction.editReply('You don\'t have any cards in your collection yet!');
        }

        // Find the card in the user's collection
        const userCard = userCollection.cards.find(card => 
            card.cardId && card.cardId.name && card.cardId.name.toLowerCase() === cardName.toLowerCase()
        );

        if (!userCard || !userCard.cardId) {
            return await interaction.editReply('You haven\'t discovered this card yet!');
        }

        // Get the full card details
        let card = userCard.cardId;
        const isFusedCard = userCard.cardType === 'FusedCard';

        // If it's a fused card, populate the parent cards separately
        if (isFusedCard) {
            card = await FusedCard.findById(card._id)
                .populate('parentCards.cardId');
        }

        // Create embed fields array
        const fields = [
            { name: 'Type', value: isFusedCard ? 'Fused Card' : 'Regular Card', inline: true },
            { name: 'Rarity', value: capitalizeFirst(card.rarity || 'common'), inline: true },
            { name: 'Set', value: card.set || 'Unknown Set', inline: true },
            { name: 'Power', value: (card.power || 0).toString(), inline: true },
            { name: 'Quantity', value: userCard.quantity.toString(), inline: true }
        ];

        // If it's a fused card, add parent card information
        if (isFusedCard && card.parentCards && card.parentCards.length > 0) {
            const parentCardsInfo = card.parentCards
                .filter(parent => parent.cardId && parent.cardId.name)
                .map(parent => {
                    const parentName = parent.cardId.name;
                    const quantity = parent.quantity || 1;
                    return `${parentName} (x${quantity})`;
                })
                .join('\n');
            
            if (parentCardsInfo) {
                fields.push({ 
                    name: 'Fused From', 
                    value: parentCardsInfo,
                    inline: false 
                });

                // Add fusion creator info
                fields.push({
                    name: 'Created By',
                    value: `<@${card.fusedBy}>`,
                    inline: true
                });
            } else {
                fields.push({
                    name: 'Fused From',
                    value: 'Parent card information unavailable',
                    inline: false
                });
            }
        }

        // Create the embed
        const embed = new MessageEmbed()
            .setColor(getRarityColor(card.rarity))
            .setTitle(card.name)
            .setDescription(card.description || 'No description available')
            .addFields(fields)
            .setFooter({ text: `Card ID: ${card._id}` })
            .setTimestamp();

        if (card.imageUrl) {
            embed.setImage(card.imageUrl);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in /tcg inspect command:', error);
        await interaction.editReply('There was an error inspecting the card. Please try again later.');
    }
}

function getRarityColor(rarity) {
    const colors = {
        common: 0x808080,    // Gray
        uncommon: 0x00FF00,  // Green
        rare: 0x0000FF,      // Blue
        legendary: 0xFFD700, // Gold
        fused: 0xFF00FF      // Purple
    };
    return colors[rarity] || 0x808080;
}

function capitalizeFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = {
    data,
    execute
}; 