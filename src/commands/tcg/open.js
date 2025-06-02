const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const Card = require('../../models/Card');
const UserCollection = require('../../models/UserCollection');
const UserCredits = require('../../models/UserCredits');
const config = require('../../config/config');
const User = require('../../models/User');
const { createPackImage } = require('../../utils/imageUtils');

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
    // Defer reply immediately before any database operations
    if (!interaction.deferred && !interaction.replied) {
        try {
            await interaction.deferReply();
        } catch (error) {
            if (error.code === 10062) {
                console.error('Interaction timed out before we could respond');
                return;
            }
            throw error;
        }
    }

    try {
        const userId = interaction.user.id;

        // Run database queries in parallel
        const [user, userCollection, userCredits] = await Promise.all([
            User.findOne({ userId }),
            UserCollection.findOne({ userId }),
            UserCredits.findOne({ userId })
        ]);

        // Register new user if they don't exist
        if (!user) {
            const newUser = new User({
                userId: userId,
                username: interaction.user.username
            });
            await newUser.save();
            user = newUser;
        }

        // Create collection if it doesn't exist
        if (!userCollection) {
            const newCollection = new UserCollection({
                userId: userId,
                cards: []
            });
            await newCollection.save();
            userCollection = newCollection;
        }

        // Create credits if they don't exist
        if (!userCredits) {
            const newCredits = new UserCredits({
                userId: userId,
                credits: 10 // Starting credits
            });
            await newCredits.save();
            userCredits = newCredits;
        }

        // Check if user has enough credits
        if (userCredits.credits < config.packCost) {
            const message = `You don't have enough ${config.currencyName} to open a pack! You need ${config.packCost} ${config.currencyName}.`;
            if (interaction.deferred) {
                await interaction.editReply(message);
            } else if (!interaction.replied) {
                await interaction.reply({ content: message, ephemeral: true });
            }
            return;
        }

        // Deduct pack cost immediately
        userCredits.credits -= config.packCost;
        await userCredits.save();

        // Generate pack contents and process cards in parallel
        const packContents = await generatePack();
        const xpResult = await user.addXp(10); // Award 10 XP for opening a pack

        // Process cards in parallel
        const cardPromises = packContents.map(async (card) => {
            if (!card || !card._id || !card.name) {
                console.error('Debug - Invalid card object:', card);
                return null;
            }

            const isSpecial = config.canGenerateSpecialCards() && Math.random() < config.specialChance;
            const existingCard = userCollection.cards.find(c => 
                c.cardId && c.cardId.toString() === card._id.toString() && 
                c.cardType === 'Card' &&
                c.special === isSpecial
            );

            if (existingCard) {
                existingCard.quantity += 1;
            } else {
                userCollection.cards.push({
                    cardId: card._id,
                    cardType: 'Card',
                    quantity: 1,
                    special: isSpecial
                });
            }

            return {
                card,
                isSpecial
            };
        });

        const processedCards = (await Promise.all(cardPromises)).filter(Boolean);
        await userCollection.save();

        // Create the combined pack image
        const cardData = processedCards.map(({ card, isSpecial }) => ({
            url: card.imageUrl || '',
            isSpecial
        }));

        // Filter out any cards with empty URLs before creating the pack image
        const validCardData = cardData.filter(data => data.url && data.url.trim() !== '');
        
        // Generate pack image and card strings in parallel
        const [packImageBuffer, cardsFoundValue] = await Promise.all([
            validCardData.length > 0 
                ? createPackImage(validCardData)
                : createPackImage([{ url: '', isSpecial: false }]),
            Promise.resolve(processedCards.map(({ card, isSpecial }) => {
                const special = isSpecial ? `${config.specialPrefix} ` : '';
                return `${getRarityEmoji(card.rarity)} **${special}${card.name}** (${capitalizeFirst(card.rarity)})`;
            }).join('\n'))
        ]);

        // Create and send the embed
        const embed = {
            color: 0x41E1F2,
            title: '🎴 Pack Opening Results',
            description: `You spent ${config.packCost} ${config.currencyName} to open a pack!`,
            fields: [
                {
                    name: 'Cards Found',
                    value: cardsFoundValue || 'No cards found in this pack.',
                    inline: false
                }
            ],
            timestamp: new Date().toISOString()
        };

        // Only add these fields if they have values
        if (xpResult && xpResult.xpGained) {
            const xpGainedValue = `+${xpResult.xpGained} XP${xpResult.newLevel > user.level ? `\n🎉 Level Up! You are now level ${xpResult.newLevel}!` : ''}`;
            embed.fields.push({
                name: 'Experience Gained',
                value: xpGainedValue,
                inline: true
            });
        }

        if (userCredits && typeof userCredits.credits === 'number') {
            embed.fields.push({
                name: 'New Balance',
                value: `${userCredits.credits} ${config.currencyName}`,
                inline: true
            });
        }

        if (xpResult && xpResult.currentXp !== undefined && xpResult.xpForNextLevel) {
            embed.footer = { 
                text: `Progress to next level: ${xpResult.currentXp}/${xpResult.xpForNextLevel} XP`
            };
        }

        // Send the image response publicly first
        if (!interaction.replied) {
            await interaction.editReply({
                files: [{
                    attachment: packImageBuffer,
                    name: 'pack-opening.png',
                    description: 'Your opened pack of cards'
                }]
            });

            // Then send the embed as an ephemeral follow-up
            await interaction.followUp({
                embeds: [embed],
                ephemeral: true
            });
        }

    } catch (error) {
        console.error('Error in /tcg open command:', error);
        const errorMessage = 'There was an error opening the pack. Please try again later.';
        
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            } else if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage, ephemeral: true });
            }
        } catch (replyError) {
            if (replyError.code === 10062) {
                console.error('Interaction timed out while sending error message');
                return;
            }
            console.error('Error sending error message:', replyError);
        }
    }
}

module.exports = {
    data,
    execute
}; 