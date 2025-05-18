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
        const userCollection = await UserCollection.findOne({ userId })
            .populate('cards.cardId');

        if (!userCollection || userCollection.cards.length === 0) {
            return interaction.editReply('Your collection is empty.');
        }

        const processedCards = [];
        const rarityGroups = {
            common: { emoji: '⚪', cards: [] },
            uncommon: { emoji: '🟢', cards: [] },
            rare: { emoji: '🔵', cards: [] },
            legendary: { emoji: '🟣', cards: [] },
            fused: { emoji: '✨', cards: [] },
            unknown: { emoji: '❓', cards: [] }
        };

        for (const card of userCollection.cards) {
            if (!card.cardId) continue;

            let cardInfo = {
                name: card.cardId.name,
                description: card.cardId.description,
                power: card.cardId.power,
                set: card.cardId.set,
                quantity: card.quantity,
                special: card.special
            };

            if (card.cardId.rarity === 'fused') {
                try {
                    const fusedCard = await FusedCard.findById(card.cardId._id)
                        .populate('parentCards.cardId');

                    if (fusedCard) {
                        const parentInfo = fusedCard.parentCards
                            .filter(p => p.cardId)
                            .map(p => `${p.cardId.name} (${p.quantity} used)`)
                            .join(' + ');

                        cardInfo.description = fusedCard.description;
                        cardInfo.set = 'Fusion';
                        cardInfo.fusionInfo = `Fused from: ${parentInfo}`;
                    }
                } catch (error) {
                    console.error('Error populating fused card:', error);
                }
            }

            const rarity = card.cardId.rarity?.toLowerCase() || 'unknown';
            const group = rarityGroups[rarity] || rarityGroups.unknown;
            group.cards.push(cardInfo);
        }

        const embed = new MessageEmbed()
            .setColor('#FFD700')
            .setTitle(`${interaction.user.username}'s Collection`)
            .setDescription('Here are all the cards in your collection:')
            .setTimestamp();

        const displayOrder = ['common', 'uncommon', 'rare', 'legendary', 'fused', 'unknown'];
        for (const rarity of displayOrder) {
            const group = rarityGroups[rarity];
            if (group.cards.length > 0) {
                const cardList = group.cards.map(card => {
                    const specialMark = card.special ? '🌟 ' : '';
                    const fusionInfo = card.fusionInfo ? `\n${card.fusionInfo}` : '';
                    return `${specialMark}${group.emoji} **${card.name}** (${card.quantity}x) - Power: ${card.power}\n${card.description}${fusionInfo}`;
                }).join('\n\n');

                embed.addField(
                    `${group.emoji} ${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Cards`,
                    cardList || 'No cards in this category.'
                );
            }
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in showcollection command:', error);
        await interaction.editReply('An error occurred while fetching your collection.');
    }
}

module.exports = { data, execute }; 