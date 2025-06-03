const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const UserCollection = require('../../models/UserCollection');
const { Card, CARD_TYPES } = require('../../models/Card');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('view')
    .setDescription('View your card collection')
    .addStringOption(option =>
        option.setName('card')
            .setDescription('The name of the card to view')
            .setRequired(false))
    .addStringOption(option =>
        option.setName('rarity')
            .setDescription('Filter cards by rarity')
            .setRequired(false)
            .addChoices(
                { name: 'Common', value: 'common' },
                { name: 'Uncommon', value: 'uncommon' },
                { name: 'Rare', value: 'rare' },
                { name: 'Legendary', value: 'legendary' },
                { name: 'Deity', value: 'deity' },
                { name: 'Fused', value: 'fused' }
            ))
    .addStringOption(option =>
        option.setName('type')
            .setDescription('Filter cards by type')
            .setRequired(false)
            .addChoices(
                { name: 'Blood', value: CARD_TYPES.BLOOD },
                { name: 'Mind', value: CARD_TYPES.MIND },
                { name: 'Time', value: CARD_TYPES.TIME },
                { name: 'Tech', value: CARD_TYPES.TECH },
                { name: 'Arcane', value: CARD_TYPES.ARCANE },
                { name: 'Necrotic', value: CARD_TYPES.NECROTIC },
                { name: 'Deity', value: CARD_TYPES.DEITY }
            ));

function getRarityEmoji(rarity) {
    const emojis = {
        common: '⚪',
        uncommon: '🟢',
        rare: '🔵',
        legendary: '��',
        deity: '🟡',
        fused: '✨'
    };
    return emojis[rarity] || '⚪';
}

function getTypeEmoji(type) {
    const emojis = {
        [CARD_TYPES.BLOOD]: '🩸',
        [CARD_TYPES.MIND]: '🧠',
        [CARD_TYPES.TIME]: '⏳',
        [CARD_TYPES.TECH]: '⚡',
        [CARD_TYPES.ARCANE]: '✨',
        [CARD_TYPES.NECROTIC]: '💀',
        [CARD_TYPES.DEITY]: '🌟'
    };
    return emojis[type] || '❓';
}

function getTypeEffectivenessDescription(type) {
    const { TYPE_STRENGTHS } = require('../../models/Card');
    const strengths = TYPE_STRENGTHS[type].strong.map(t => `${getTypeEmoji(t)} ${t}`).join(', ');
    const weaknesses = TYPE_STRENGTHS[type].weak.map(t => `${getTypeEmoji(t)} ${t}`).join(', ');
    return `Strong against: ${strengths}\nWeak against: ${weaknesses}`;
}

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const userId = interaction.user.id;
        const cardName = interaction.options.getString('card');
        const rarityFilter = interaction.options.getString('rarity');
        const typeFilter = interaction.options.getString('type');

        let userCollection = await UserCollection.findOne({ userId })
            .populate({
                path: 'cards.cardId',
                refPath: 'cards.cardType'
            });

        if (!userCollection) {
            await interaction.editReply('You don\'t have any cards in your collection yet!');
            return;
        }

        // Filter cards based on options
        let cards = userCollection.cards.filter(c => c.cardId && c.quantity > 0);
        
        if (cardName) {
            cards = cards.filter(c => 
                c.cardId.name.toLowerCase().includes(cardName.toLowerCase())
            );
        }
        
        if (rarityFilter) {
            cards = cards.filter(c => c.cardId.rarity === rarityFilter);
        }

        if (typeFilter) {
            cards = cards.filter(c => c.cardId.type === typeFilter);
        }

        if (cards.length === 0) {
            await interaction.editReply('No cards found matching your criteria.');
            return;
        }

        // Sort cards by rarity and name
        const rarityOrder = ['common', 'uncommon', 'rare', 'legendary', 'deity', 'fused'];
        cards.sort((a, b) => {
            const rarityDiff = rarityOrder.indexOf(a.cardId.rarity) - rarityOrder.indexOf(b.cardId.rarity);
            if (rarityDiff !== 0) return rarityDiff;
            return a.cardId.name.localeCompare(b.cardId.name);
        });

        // Create the response
        const cardDetails = cards.map(card => {
            const special = card.special ? `${config.specialPrefix} ` : '';
            const typeEmoji = getTypeEmoji(card.cardId.type);
            return `${getRarityEmoji(card.cardId.rarity)} **${special}${card.cardId.name}** (${card.cardId.rarity.charAt(0).toUpperCase() + card.cardId.rarity.slice(1)}) ${typeEmoji} ${card.cardId.type}\n` +
                   `Quantity: ${card.quantity}\n` +
                   `Set: ${card.cardId.set}\n` +
                   `${card.cardId.description}\n` +
                   `Type Effectiveness:\n${getTypeEffectivenessDescription(card.cardId.type)}\n`;
        });

        // Split into chunks if too long
        const chunks = [];
        let currentChunk = '';
        
        for (const card of cardDetails) {
            if (currentChunk.length + card.length > 1024) {
                chunks.push(currentChunk);
                currentChunk = card;
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + card;
            }
        }
        if (currentChunk) chunks.push(currentChunk);

        // Send the response
        for (let i = 0; i < chunks.length; i++) {
            const embed = {
                color: 0x41E1F2,
                title: i === 0 ? 'Your Card Collection' : `Your Card Collection (Page ${i + 1})`,
                description: chunks[i],
                timestamp: new Date().toISOString()
            };

            if (i === chunks.length - 1) {
                embed.footer = { text: `Total cards: ${cards.length}` };
            }

            await (i === 0 ? interaction.editReply({ embeds: [embed] }) : interaction.followUp({ embeds: [embed], ephemeral: true }));
        }

    } catch (error) {
        console.error('Error in /tcg view command:', error);
        await interaction.editReply('There was an error viewing your collection. Please try again later.');
    }
}

module.exports = {
    data,
    execute
}; 