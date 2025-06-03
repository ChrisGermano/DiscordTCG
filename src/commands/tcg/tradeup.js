const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const UserCollection = require('../../models/UserCollection');
const Card = require('../../models/Card');
const FusedCard = require('../../models/FusedCard');
const config = require('../../config/config');
const User = require('../../models/User');

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
        const userId = interaction.user.id;
        let user = await User.findOne({ userId });
        let userCollection = await UserCollection.findOne({ userId })
            .populate({
                path: 'cards.cardId',
                refPath: 'cards.cardType'
            });

        // Register new user if they don't exist
        if (!user) {
            user = new User({
                userId: userId,
                username: interaction.user.username
            });
            await user.save();
        }

        // Create collection if it doesn't exist
        if (!userCollection) {
            userCollection = new UserCollection({
                userId: userId,
                cards: []
            });
            await userCollection.save();
        }

        const cardName = interaction.options.getString('card');
        const cardToTrade = userCollection.cards.find(c => 
            c.cardId && c.cardId.name.toLowerCase() === cardName.toLowerCase() && 
            c.quantity >= 5
        );

        if (!cardToTrade || !cardToTrade.cardId) {
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

        // Get a random card of the next rarity using aggregation
        const newCard = await Card.aggregate([
            { $match: { rarity: nextRarity } },
            { $sample: { size: 1 } }
        ]).then(results => results[0]);

        if (!newCard) {
            await interaction.editReply('There was an error finding a card to trade up to. Please try again later.');
            return;
        }

        // Update quantities
        cardToTrade.quantity -= 5;
        if (cardToTrade.quantity === 0) {
            userCollection.cards = userCollection.cards.filter(c => 
                c.cardId._id.toString() !== cardToTrade.cardId._id.toString() || 
                c.cardType !== cardToTrade.cardType
            );
        }

        // Add the new card
        const existingNewCard = userCollection.cards.find(c => 
            c.cardId && c.cardId._id.toString() === newCard._id.toString() && 
            c.cardType === 'Card'
        );

        if (existingNewCard) {
            existingNewCard.quantity += 1;
        } else {
            userCollection.cards.push({
                cardId: newCard._id,
                cardType: 'Card',
                quantity: 1,
                special: config.canGenerateSpecialCards() && Math.random() < config.specialChance
            });
        }

        // Award XP for trading up
        const xpResult = await user.addXp(25);

        await userCollection.save();

        const rarityEmoji = {
            common: '⚪',
            uncommon: '🟢',
            rare: '🔵',
            legendary: '🟣',
            deity: '🌟',
            fused: '✨'
        }[nextRarity];

        // Find the newly added card to check if it's special
        const addedCard = userCollection.cards.find(c => 
            c.cardId && c.cardId._id.toString() === newCard._id.toString() && 
            c.cardType === 'Card'
        );

        const newCardName = addedCard.special ? `${config.specialPrefix} ${newCard.name}` : newCard.name;

        let response = `**Trade Up Successful!**\n\n`;
        response += `Traded 5x ${currentCard.name} for:\n`;
        response += `${rarityEmoji} ${newCardName}\n`;
        response += `*${newCard.description}*\n`;
        response += `Set: **${newCard.set}**\n`;
        response += `Experience Gained: +${xpResult.xpGained} XP`;
        if (xpResult.xenitharBonus) {
            response += ' (1.5x from Xenithar the Core Cognizant)';
        }
        if (xpResult.newLevel > user.level) {
            response += `\n🎉 Level Up! You are now level ${xpResult.newLevel}!`;
        }
        response += `\nProgress to next level: ${xpResult.currentXp}/${xpResult.xpForNextLevel} XP`;

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