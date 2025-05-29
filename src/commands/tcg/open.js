const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const Card = require('../../models/Card');
const UserCollection = require('../../models/UserCollection');
const UserCredits = require('../../models/UserCredits');
const config = require('../../config/config');
const User = require('../../models/User');

const data = new SlashCommandSubcommandBuilder()
    .setName('open')
    .setDescription(`Open a new pack of cards (Costs ${config.packCost} ${config.currencyName})`);

async function generatePack() {
    // Get 3 common cards
    const commonCards = await Card.aggregate([
        { $match: { rarity: 'common' } },
        { $sample: { size: 3 } }
    ]);

    // Get 1 uncommon card
    const uncommonCard = await Card.aggregate([
        { $match: { rarity: 'uncommon' } },
        { $sample: { size: 1 } }
    ]);

    // Get 1 rare or legendary card (with legendary chance)
    const isLegendary = Math.random() < config.legendaryChance;
    const rareOrLegendary = await Card.aggregate([
        { $match: { rarity: isLegendary ? 'legendary' : 'rare' } },
        { $sample: { size: 1 } }
    ]);

    return [...commonCards, ...uncommonCard, ...rareOrLegendary];
}

function getRarityEmoji(rarity) {
    const emojis = {
        common: '⚪',
        uncommon: '🟢',
        rare: '🔵',
        legendary: '🟣',
        fused: '✨'
    };
    return emojis[rarity] || '⚪';
}

function capitalizeFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const userId = interaction.user.id;
        let user = await User.findOne({ userId });
        let userCollection = await UserCollection.findOne({ userId });
        let userCredits = await UserCredits.findOne({ userId });

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

        // Create credits if they don't exist
        if (!userCredits) {
            userCredits = new UserCredits({
                userId: userId,
                credits: 10 // Starting credits
            });
            await userCredits.save();
        }

        // Check if user has enough credits
        if (userCredits.credits < config.packCost) {
            return await interaction.editReply(`You don't have enough ${config.currencyName} to open a pack! You need ${config.packCost} ${config.currencyName}.`);
        }

        // Deduct pack cost
        userCredits.credits -= config.packCost;
        await userCredits.save();

        // Generate pack contents
        const packContents = await generatePack();
        
        // Add cards to collection and award XP
        const xpResult = await user.addXp(10); // Award 10 XP for opening a pack
        const addedCards = [];
        
        for (const card of packContents) {
            const existingCard = userCollection.cards.find(c => 
                c.cardId && c.cardId.toString() === card._id.toString() && 
                c.cardType === 'Card'
            );
            if (existingCard) {
                existingCard.quantity += 1;
            } else {
                userCollection.cards.push({
                    cardId: card._id,
                    cardType: 'Card',
                    quantity: 1,
                    special: config.canGenerateSpecialCards() && Math.random() < config.specialChance
                });
            }
            addedCards.push(card);
        }
        
        await userCollection.save();

        // Create embed for response
        const embed = {
            color: 0x41E1F2,
            title: '🎴 Pack Opening Results',
            description: `You spent ${config.packCost} ${config.currencyName} to open a pack!`,
            fields: [
                {
                    name: 'Cards Found',
                    value: addedCards.map(card => 
                        `${getRarityEmoji(card.rarity)} **${card.name}** (${capitalizeFirst(card.rarity)})`
                    ).join('\n'),
                    inline: false
                },
                {
                    name: 'Experience Gained',
                    value: `+${xpResult.xpGained} XP${xpResult.newLevel > user.level ? `\n🎉 Level Up! You are now level ${xpResult.newLevel}!` : ''}`,
                    inline: true
                },
                {
                    name: 'New Balance',
                    value: `${userCredits.credits} ${config.currencyName}`,
                    inline: true
                }
            ],
            footer: { 
                text: `Progress to next level: ${xpResult.currentXp}/${xpResult.xpForNextLevel} XP` 
            },
            timestamp: new Date().toISOString()
        };

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in /tcg open command:', error);
        await interaction.editReply('There was an error opening the pack. Please try again later.');
    }
}

module.exports = {
    data,
    execute
}; 