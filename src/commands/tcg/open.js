const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const Card = require('../../models/Card');
const UserCollection = require('../../models/UserCollection');
const UserCredits = require('../../models/UserCredits');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('open')
    .setDescription(`Open a new pack of cards (Costs ${config.packCost} ${config.currencyName})`);

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        let userCredits = await UserCredits.findOne({ userId: interaction.user.id });
        if (!userCredits) {
            userCredits = new UserCredits({ userId: interaction.user.id });
        }

        if (userCredits.credits < config.packCost) {
            await interaction.editReply(`You need ${config.packCost} ${config.currencyName} to open a pack. You currently have ${userCredits.credits} ${config.currencyName}. Use /tcg earn to earn more!`);
            return;
        }

        userCredits.credits -= config.packCost;
        await userCredits.save();

        const commonCards = await Card.aggregate([
            { $match: { rarity: 'common' } },
            { $sample: { size: 3 } }
        ]);

        const uncommonCard = await Card.aggregate([
            { $match: { rarity: 'uncommon' } },
            { $sample: { size: 1 } }
        ]);

        const isLegendary = Math.random() < config.legendaryChance;
        const rareOrLegendary = await Card.aggregate([
            { $match: { rarity: isLegendary ? 'legendary' : 'rare' } },
            { $sample: { size: 1 } }
        ]);

        const allCards = [...commonCards, ...uncommonCard, ...rareOrLegendary];

        let userCollection = await UserCollection.findOne({ userId: interaction.user.id });
        
        if (!userCollection) {
            userCollection = new UserCollection({
                userId: interaction.user.id,
                cards: []
            });
        }

        const cardVFECStatus = new Map();

        for (const card of allCards) {
            const isVFEC = config.canGenerateSpecialCards() && Math.random() < config.vfecChance;
            cardVFECStatus.set(card._id.toString(), isVFEC);
            
            const existingCard = userCollection.cards.find(c => 
                c.cardId.toString() === card._id.toString() && 
                c.VFEC === isVFEC
            );

            if (existingCard) {
                existingCard.quantity += 1;
            } else {
                userCollection.cards.push({
                    cardId: card._id,
                    quantity: 1,
                    VFEC: isVFEC
                });
            }
        }

        await userCollection.save();

        let response = `**${interaction.user.username} opened a pack!**\n\n`;
        response += `**Cards received:**\n`;
        allCards.forEach(card => {
            const rarityEmoji = {
                common: '⚪',
                uncommon: '🟢',
                rare: '🔵',
                legendary: '🟣'
            }[card.rarity];
            const isVFEC = cardVFECStatus.get(card._id.toString());
            const cardName = isVFEC ? `${config.specialPrefix} ${card.name}` : card.name;
            response += `${rarityEmoji} ${cardName}\n`;
            response += `*${card.description}*\n`;
            response += `Set: **${card.set}**\n\n`;
        });

        await interaction.editReply(response);

    } catch (error) {
        console.error('Error in /tcg open command:', error);
        await interaction.editReply('There was an error opening your pack. Please try again later.');
    }
}

module.exports = {
    data,
    execute
}; 