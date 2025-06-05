const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const Card = require('../../models/Card');
const UserCollection = require('../../models/UserCollection');
const FusedCard = require('../../models/FusedCard');
const { MessageEmbed } = require('discord.js');
const { processCardImage } = require('../../utils/imageUtils');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('inspect')
    .setDescription('Inspect a card from your collection in detail')
    .addStringOption(option =>
        option.setName('card')
            .setDescription('The name of the card to inspect (include special prefix if it\'s a special card)')
            .setRequired(true)
            .setAutocomplete(true));

async function autocomplete(interaction) {
    try {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const userId = interaction.user.id;

        // Get user's collection
        const userCollection = await UserCollection.findOne({ userId })
            .populate({
                path: 'cards.cardId',
                refPath: 'cards.cardType'
            });

        if (!userCollection) {
            return await interaction.respond([]);
        }

        // Filter cards based on the focused value
        const matchingCards = userCollection.cards
            .filter(card => 
                card.cardId && 
                card.cardId.name && 
                (card.cardId.name.toLowerCase().includes(focusedValue) ||
                (card.special && `${config.specialPrefix} ${card.cardId.name}`.toLowerCase().includes(focusedValue)))
            )
            .map(card => ({
                name: card.special ? `${config.specialPrefix} ${card.cardId.name}` : card.cardId.name,
                value: card.special ? `${config.specialPrefix} ${card.cardId.name}` : card.cardId.name
            }))
            // Remove duplicates (in case user has multiple copies)
            .filter((card, index, self) => 
                index === self.findIndex(c => c.value === card.value)
            )
            // Sort alphabetically
            .sort((a, b) => a.name.localeCompare(b.name))
            // Limit to 25 choices (Discord's limit)
            .slice(0, 25);

        await interaction.respond(matchingCards);
    } catch (error) {
        console.error('Error in inspect command autocomplete:', error);
        await interaction.respond([]);
    }
}

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

        // Check if the card name includes the special prefix
        const isSpecialSearch = cardName.startsWith(config.specialPrefix);
        const searchName = isSpecialSearch ? cardName.slice(config.specialPrefix.length).trim() : cardName;

        // Find the card in the user's collection
        const userCard = userCollection.cards.find(card => 
            card.cardId && 
            card.cardId.name && 
            card.cardId.name.toLowerCase() === searchName.toLowerCase() &&
            card.special === isSpecialSearch
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

        // Process the card image if it exists
        let processedImageBuffer;
        if (card.imageUrl) {
            processedImageBuffer = await processCardImage(card.imageUrl, userCard.special);
        }

        // Create embed fields array
        const fields = [
            { name: 'Type', value: isFusedCard ? 'Fused Card' : capitalizeFirst(card.type || 'Unknown'), inline: true },
            { name: 'Rarity', value: capitalizeFirst(card.rarity || 'common'), inline: true },
            { name: 'Set', value: card.set || 'Unknown Set', inline: true },
            { name: 'Power', value: (card.power || 0).toString(), inline: true },
            { name: 'Quantity', value: userCard.quantity.toString(), inline: true },
            { name: 'Special', value: userCard.special ? 'Yes' : 'No', inline: true }
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
            .setTitle(userCard.special ? `${config.specialPrefix} ${card.name}` : card.name)
            .setDescription(card.description || 'No description available')
            .addFields(fields)
            .setFooter({ text: `Card ID: ${card._id}` })
            .setTimestamp();

        // Send the response with the processed image
        if (processedImageBuffer) {
            await interaction.editReply({
                embeds: [embed],
                files: [{
                    attachment: processedImageBuffer,
                    name: 'card.png',
                    description: 'Card image'
                }]
            });
        } else {
            await interaction.editReply({ embeds: [embed] });
        }

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
    execute,
    autocomplete
}; 