const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const Trade = require('../../models/Trade');
const Card = require('../../models/Card');
const UserCollection = require('../../models/UserCollection');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const TRADE_LIMITS = {
    MAX_CARDS_PER_TRADE: 10,
    RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
    MAX_TRADES_PER_WINDOW: 3
};

const userTradeAttempts = new Map();

function checkRateLimit(userId) {
    const now = Date.now();
    const userAttempts = userTradeAttempts.get(userId) || [];
    const recentAttempts = userAttempts.filter(time => now - time < TRADE_LIMITS.RATE_LIMIT_WINDOW);
    
    if (recentAttempts.length >= TRADE_LIMITS.MAX_TRADES_PER_WINDOW) {
        const oldestAttempt = recentAttempts[0];
        const timeLeft = TRADE_LIMITS.RATE_LIMIT_WINDOW - (now - oldestAttempt);
        return { 
            allowed: false, 
            timeLeft: Math.ceil(timeLeft / 1000)
        };
    }
    
    recentAttempts.push(now);
    userTradeAttempts.set(userId, recentAttempts);
    return { allowed: true };
}

async function validateTradePermissions(interaction, targetUser) {
    try {
        const dmChannel = await targetUser.createDM();
        await dmChannel.send('Testing trade permissions...');
        await dmChannel.delete();
    } catch (error) {
        return { 
            valid: false, 
            message: 'Cannot send trade offers to this user. They may have DMs disabled or blocked the bot.' 
        };
    }

    if (!interaction.guild.members.cache.has(targetUser.id)) {
        return { 
            valid: false, 
            message: 'Cannot trade with users outside this server.' 
        };
    }

    return { valid: true };
}

async function validateCards(userId, cardNames, quantities = {}) {
    const userCollection = await UserCollection.findOne({ userId })
        .populate({
            path: 'cards.cardId',
            refPath: 'cards.cardType'
        });
    
    if (!userCollection) return { valid: false, message: 'You don\'t have any cards.' };

    const cards = cardNames.split(',').map(name => name.trim());
    
    if (cards.length > TRADE_LIMITS.MAX_CARDS_PER_TRADE) {
        return { 
            valid: false, 
            message: `You can only trade up to ${TRADE_LIMITS.MAX_CARDS_PER_TRADE} cards at once.` 
        };
    }

    const validatedCards = [];
    const pendingTrades = await Trade.find({
        $or: [{ initiatorId: userId }, { targetId: userId }],
        status: 'pending'
    }).populate('initiatorCards.cardId targetCards.cardId');

    for (const cardName of cards) {
        const card = userCollection.cards.find(c => 
            c.cardId && c.cardId.name.toLowerCase() === cardName.toLowerCase()
        );

        if (!card) {
            return { valid: false, message: `You don't have "${cardName}" in your collection.` };
        }

        if (card.special) {
            return { valid: false, message: `"${cardName}" is a special card and cannot be traded.` };
        }

        const quantity = quantities[cardName] || 1;
        if (card.quantity < quantity) {
            return { valid: false, message: `You only have ${card.quantity} copies of "${cardName}".` };
        }

        // Check if card is already in a pending trade
        const isInPendingTrade = pendingTrades.some(trade => {
            const allCards = [...trade.initiatorCards, ...trade.targetCards];
            return allCards.some(t => 
                t.cardId._id.toString() === card.cardId._id.toString() && 
                t.cardType === card.cardType &&
                t.quantity >= quantity
            );
        });

        if (isInPendingTrade) {
            return { valid: false, message: `"${cardName}" is already part of a pending trade.` };
        }

        validatedCards.push({
            cardId: card.cardId._id,
            cardType: card.cardType,
            quantity: quantity
        });
    }

    return { valid: true, cards: validatedCards };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trade')
        .setDescription('Trade cards with other users')
        .addSubcommand(subcommand =>
            subcommand
                .setName('offer')
                .setDescription('Offer a trade to another user')
                .addStringOption(option =>
                    option.setName('cards')
                        .setDescription('Cards you want to trade (comma-separated)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('for')
                        .setDescription('Cards you want in return (comma-separated)')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to trade with')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('accept')
                .setDescription('Accept a trade offer')
                .addStringOption(option =>
                    option.setName('trade_id')
                        .setDescription('ID of the trade to accept')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Cancel a trade offer')
                .addStringOption(option =>
                    option.setName('trade_id')
                        .setDescription('ID of the trade to cancel')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'offer': {
                const rateLimit = checkRateLimit(interaction.user.id);
                if (!rateLimit.allowed) {
                    return interaction.reply(
                        `You're trading too quickly. Please wait ${rateLimit.timeLeft} seconds before trying again.`
                    );
                }

                const targetUser = interaction.options.getUser('user');
                if (targetUser.id === interaction.user.id) {
                    return interaction.reply('You cannot trade with yourself.');
                }

                const permissionsCheck = await validateTradePermissions(interaction, targetUser);
                if (!permissionsCheck.valid) {
                    return interaction.reply(permissionsCheck.message);
                }

                const cardsToTrade = interaction.options.getString('cards');
                const cardsToReceive = interaction.options.getString('for');

                const [initiatorValidation, targetValidation] = await Promise.all([
                    validateCards(interaction.user.id, cardsToTrade),
                    validateCards(targetUser.id, cardsToReceive)
                ]);

                if (!initiatorValidation.valid) {
                    return interaction.reply(initiatorValidation.message);
                }
                if (!targetValidation.valid) {
                    return interaction.reply(`Target user ${targetValidation.message}`);
                }

                const trade = new Trade({
                    tradeId: uuidv4(),
                    initiatorId: interaction.user.id,
                    targetId: targetUser.id,
                    initiatorCards: initiatorValidation.cards,
                    targetCards: targetValidation.cards
                });

                await trade.save();

                const embed = new MessageEmbed()
                    .setColor('#FFD700')
                    .setTitle('🔄 Trade Offer')
                    .setDescription(`Trade offer from ${interaction.user.username} to ${targetUser.username}`)
                    .addFields(
                        { name: 'Offering', value: cardsToTrade, inline: true },
                        { name: 'Requesting', value: cardsToReceive, inline: true },
                        { name: 'Trade ID', value: trade.tradeId }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                await targetUser.send({ embeds: [embed] });
                break;
            }

            case 'accept': {
                const tradeId = interaction.options.getString('trade_id');
                const session = await mongoose.startSession();
                
                try {
                    await session.withTransaction(async () => {
                        const trade = await Trade.findOne({ tradeId, status: 'pending' })
                            .session(session);

                        if (!trade) {
                            throw new Error('Trade offer not found or already processed.');
                        }

                        if (trade.targetId !== interaction.user.id) {
                            throw new Error('This trade offer is not for you.');
                        }

                        const [initiatorCollection, targetCollection] = await Promise.all([
                            UserCollection.findOne({ userId: trade.initiatorId }).session(session),
                            UserCollection.findOne({ userId: trade.targetId }).session(session)
                        ]);

                        if (!initiatorCollection || !targetCollection) {
                            throw new Error('One or both users\' collections not found.');
                        }

                        // Validate cards are still available
                        const [initiatorValidation, targetValidation] = await Promise.all([
                            validateCards(trade.initiatorId, trade.initiatorCards.map(c => c.cardId).join(','), 
                                Object.fromEntries(trade.initiatorCards.map(c => [c.cardId, c.quantity]))),
                            validateCards(trade.targetId, trade.targetCards.map(c => c.cardId).join(','),
                                Object.fromEntries(trade.targetCards.map(c => [c.cardId, c.quantity])))
                        ]);

                        if (!initiatorValidation.valid || !targetValidation.valid) {
                            trade.status = 'cancelled';
                            trade.cancelledBy = interaction.user.id;
                            await trade.save({ session });
                            throw new Error('Trade cancelled: Cards are no longer available.');
                        }

                        // Execute the trade within transaction
                        for (const card of trade.initiatorCards) {
                            const initiatorCard = initiatorCollection.cards.find(c => 
                                c.cardId.toString() === card.cardId.toString() && 
                                c.cardType === card.cardType
                            );
                            const targetCard = targetCollection.cards.find(c => 
                                c.cardId.toString() === card.cardId.toString() && 
                                c.cardType === card.cardType
                            );

                            initiatorCard.quantity -= card.quantity;
                            if (initiatorCard.quantity <= 0) {
                                initiatorCollection.cards = initiatorCollection.cards.filter(c => 
                                    c.cardId.toString() !== initiatorCard.cardId.toString() || 
                                    c.cardType !== initiatorCard.cardType
                                );
                            }

                            if (targetCard) {
                                targetCard.quantity += card.quantity;
                            } else {
                                targetCollection.cards.push({
                                    cardId: card.cardId,
                                    cardType: card.cardType,
                                    quantity: card.quantity,
                                    special: false
                                });
                            }
                        }

                        for (const card of trade.targetCards) {
                            const targetCard = targetCollection.cards.find(c => 
                                c.cardId.toString() === card.cardId.toString() && 
                                c.cardType === card.cardType
                            );
                            const initiatorCard = initiatorCollection.cards.find(c => 
                                c.cardId.toString() === card.cardId.toString() && 
                                c.cardType === card.cardType
                            );

                            targetCard.quantity -= card.quantity;
                            if (targetCard.quantity <= 0) {
                                targetCollection.cards = targetCollection.cards.filter(c => 
                                    c.cardId.toString() !== targetCard.cardId.toString() || 
                                    c.cardType !== targetCard.cardType
                                );
                            }

                            if (initiatorCard) {
                                initiatorCard.quantity += card.quantity;
                            } else {
                                initiatorCollection.cards.push({
                                    cardId: card.cardId,
                                    cardType: card.cardType,
                                    quantity: card.quantity,
                                    special: false
                                });
                            }
                        }

                        await Promise.all([
                            initiatorCollection.save({ session }),
                            targetCollection.save({ session }),
                            trade.save({ session })
                        ]);
                    });

                    // If we get here, transaction was successful
                    const trade = await Trade.findOne({ tradeId });
                    const embed = new MessageEmbed()
                        .setColor('#00FF00')
                        .setTitle('✅ Trade Completed')
                        .setDescription('The trade has been successfully completed!')
                        .addFields(
                            { name: 'Trade ID', value: trade.tradeId },
                            { name: 'Traded Cards', value: `${trade.initiatorCards.length} cards exchanged` }
                        )
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                    await interaction.client.users.cache.get(trade.initiatorId)?.send({ embeds: [embed] });

                } catch (error) {
                    await session.abortTransaction();
                    throw error;
                } finally {
                    await session.endSession();
                }
                break;
            }

            case 'cancel': {
                const tradeId = interaction.options.getString('trade_id');
                const trade = await Trade.findOne({ tradeId, status: 'pending' });

                if (!trade) {
                    return interaction.reply('Trade offer not found or already processed.');
                }

                if (trade.initiatorId !== interaction.user.id && trade.targetId !== interaction.user.id) {
                    return interaction.reply('You cannot cancel this trade offer.');
                }

                trade.status = 'cancelled';
                trade.cancelledBy = interaction.user.id;
                await trade.save();

                const embed = new MessageEmbed()
                    .setColor('#FF0000')
                    .setTitle('❌ Trade Cancelled')
                    .setDescription('The trade has been cancelled.')
                    .addFields(
                        { name: 'Trade ID', value: trade.tradeId },
                        { name: 'Cancelled by', value: interaction.user.username }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
                const otherUserId = trade.initiatorId === interaction.user.id ? trade.targetId : trade.initiatorId;
                await interaction.client.users.cache.get(otherUserId)?.send({ embeds: [embed] });
                break;
            }
            default: {
                await interaction.reply({
                    content: 'Invalid trade subcommand. Use `/tcg help` to see available options.',
                    ephemeral: true
                });
            }
        }
    }
}; 