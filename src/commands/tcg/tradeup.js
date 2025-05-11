const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const UserCollection = require('../../models/UserCollection');
const Card = require('../../models/Card');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('tradeup')
    .setDescription('Trade 5 of the same card for one random card of the next higher rarity')
    .addStringOption(option =>
        option.setName('card')
            .setDescription('The name of the card to trade up')
            .setRequired(true));

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const cardName = interaction.options.getString('card');
        const userCollection = await UserCollection.findOne({ userId: interaction.user.id })
            .populate('cards.cardId');

        if (!userCollection) {
            await interaction.editReply('You don\'t have any cards to trade up!');
            return;
        }

        const cardToTrade = userCollection.cards.find(c => 
            c.cardId.name.toLowerCase() === cardName.toLowerCase() && 
            c.quantity >= 5
        );

        if (!cardToTrade) {
            await interaction.editReply(`You need 5 copies of "${cardName}" to trade up.`);
            return;
        }

        const currentCard = cardToTrade.cardId;
        const rarityOrder = ['common', 'uncommon', 'rare', 'legendary'];
        const currentRarityIndex = rarityOrder.indexOf(currentCard.rarity);

        if (currentRarityIndex === rarityOrder.length - 1) {
            await interaction.editReply('You cannot trade up legendary cards!');
            return;
        }

        const nextRarity = rarityOrder[currentRarityIndex + 1];

        const newCard = await Card.aggregate([
            { $match: { rarity: nextRarity } },
            { $sample: { size: 1 } }
        ]);

        if (!newCard || newCard.length === 0) {
            await interaction.editReply('There was an error finding a card to trade up to. Please try again later.');
            return;
        }

        cardToTrade.quantity -= 5;
        if (cardToTrade.quantity === 0) {
            userCollection.cards = userCollection.cards.filter(c => c !== cardToTrade);
        }

        const existingNewCard = userCollection.cards.find(c => 
            c.cardId._id.toString() === newCard[0]._id.toString()
        );

        if (existingNewCard) {
            existingNewCard.quantity += 1;
        } else {
            userCollection.cards.push({
                cardId: newCard[0]._id,
                quantity: 1,
                special: config.canGenerateSpecialCards() && Math.random() < config.specialChance
            });
        }

        await userCollection.save();

        const rarityEmoji = {
            common: '⚪',
            uncommon: '🟢',
            rare: '🔵',
            legendary: '🟣'
        }[nextRarity];

        const newCardName = userCollection.cards.find(c => 
            c.cardId._id.toString() === newCard[0]._id.toString()
        ).special ? `${config.specialPrefix} ${newCard[0].name}` : newCard[0].name;

        let response = `**Trade Up Successful!**\n\n`;
        response += `Traded 5x ${currentCard.name} for:\n`;
        response += `${rarityEmoji} ${newCardName}\n`;
        response += `*${newCard[0].description}*\n`;
        response += `Set: **${newCard[0].set}**`;

        await interaction.editReply(response);

    } catch (error) {
        console.error('Error in /tcg tradeup command:', error);
        await interaction.editReply('There was an error processing your trade up. Please try again later.');
    }
}

module.exports = {
    data,
    execute
}; 