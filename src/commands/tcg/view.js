const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const UserCollection = require('../../models/UserCollection');
const Card = require('../../models/Card');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('view')
    .setDescription('View your card collection')
    .addStringOption(option =>
        option.setName('rarity')
            .setDescription('Filter cards by rarity')
            .setRequired(false)
            .addChoices(
                { name: 'Common', value: 'common' },
                { name: 'Uncommon', value: 'uncommon' },
                { name: 'Rare', value: 'rare' },
                { name: 'Legendary', value: 'legendary' }
            )
    )
    .addStringOption(option =>
        option.setName('set')
            .setDescription('Filter cards by set')
            .setRequired(false)
    );

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const rarity = interaction.options.getString('rarity');
        const set = interaction.options.getString('set');

        const userCollection = await UserCollection.findOne({ userId: interaction.user.id });
        if (!userCollection) {
            await interaction.editReply('You don\'t have any cards yet! Use /tcg earn to get started.');
            return;
        }

        let cards = await Card.find({
            _id: { $in: userCollection.cards.map(c => c.cardId) }
        });

        if (rarity) {
            cards = cards.filter(card => card.rarity === rarity);
        }

        if (set) {
            cards = cards.filter(card => card.set.toLowerCase() === set.toLowerCase());
        }

        if (cards.length === 0) {
            await interaction.editReply('No cards found matching your criteria.');
            return;
        }

        const cardDetails = cards.map(card => {
            const userCard = userCollection.cards.find(c => c.cardId.toString() === card._id.toString());
            const rarityEmoji = {
                common: '⚪',
                uncommon: '🟢',
                rare: '🔵',
                legendary: '🟣'
            }[card.rarity];

            const cardName = userCard.special ? `${config.specialPrefix} ${card.name}` : card.name;
            return [
                `${rarityEmoji} **${cardName}** (x${userCard.quantity})`,
                `*${card.description}*`,
                `Set: **${card.set}**`,
                `Power: **${card.power}**`,
                `Defense: **${card.defense}**`,
                ''
            ].join('\n');
        });

        const response = [
            `**${interaction.user.username}'s Collection**`,
            '',
            ...cardDetails
        ].join('\n');

        if (response.length > 2000) {
            const chunks = [];
            let currentChunk = '';
            cardDetails.forEach(detail => {
                if (currentChunk.length + detail.length > 1900) {
                    chunks.push(currentChunk);
                    currentChunk = detail;
                } else {
                    currentChunk += detail;
                }
            });
            if (currentChunk) chunks.push(currentChunk);

            for (let i = 0; i < chunks.length; i++) {
                const header = i === 0 ? `**${interaction.user.username}'s Collection**\n\n` : `**${interaction.user.username}'s Collection (Part ${i + 1})**\n\n`;
                await interaction.followUp({ content: header + chunks[i], ephemeral: true });
            }
        } else {
            await interaction.editReply(response);
        }

    } catch (error) {
        console.error('Error in /tcg view command:', error);
        await interaction.editReply('There was an error fetching your collection. Please try again later.');
    }
}

module.exports = {
    data,
    execute
}; 