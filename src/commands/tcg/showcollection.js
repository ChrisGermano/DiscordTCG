const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const UserCollection = require('../../models/UserCollection');
const Card = require('../../models/Card');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('showcollection')
    .setDescription('Show your card collection');

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const userCollection = await UserCollection.findOne({ userId: interaction.user.id })
            .populate('cards.cardId');

        if (!userCollection || userCollection.cards.length === 0) {
            await interaction.editReply('Your collection is empty. Use `/tcg open` to get some cards!');
            return;
        }

        const rarityGroups = {};
        for (const card of userCollection.cards) {
            const rarity = card.cardId.rarity;
            if (!rarityGroups[rarity]) {
                rarityGroups[rarity] = [];
            }
            const cardName = card.VFEC ? `${config.specialPrefix} ${card.cardId.name}` : card.cardId.name;
            rarityGroups[rarity].push({
                name: cardName,
                quantity: card.quantity,
                description: card.cardId.description,
                set: card.cardId.set
            });
        }

        let response = `**${interaction.user.username}'s Collection:**\n\n`;
        
        for (const rarity of ['common', 'uncommon', 'rare', 'legendary']) {
            if (rarityGroups[rarity].length > 0) {
                response += `**${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Cards:**\n`;
                response += rarityGroups[rarity].map(card => {
                    const rarityEmoji = {
                        common: '⚪',
                        uncommon: '🟢',
                        rare: '🔵',
                        legendary: '🟣'
                    }[rarity];
                    return `${rarityEmoji} ${card.name} (x${card.quantity})\n*${card.description}*\nSet: **${card.set}**\n`;
                }).join('\n') + '\n\n';
            }
        }

        await interaction.editReply(response);

    } catch (error) {
        console.error('Error in /tcg showcollection command:', error);
        await interaction.editReply('There was an error showing your collection. Please try again later.');
    }
}

module.exports = {
    data,
    execute
}; 