const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const Battle = require('../../models/Battle');
const Card = require('../../models/Card');
const UserCollection = require('../../models/UserCollection');
const FusedCard = require('../../models/FusedCard');

const BATTLE_EFFECTS = {
    common: { probability: 0.3, effects: ['power_boost', 'power_reduction'] },
    uncommon: { probability: 0.4, effects: ['power_boost', 'power_reduction', 'heal'] },
    rare: { probability: 0.5, effects: ['power_boost', 'power_reduction', 'heal', 'shield'] },
    legendary: { probability: 0.6, effects: ['power_boost', 'power_reduction', 'heal', 'shield', 'double_power'] },
    fused: { probability: 0.7, effects: ['power_boost', 'power_reduction', 'heal', 'shield', 'double_power', 'fusion_boost'] }
};

const EFFECT_MULTIPLIERS = {
    power_boost: { min: 1.1, max: 1.3 },
    power_reduction: { min: 0.7, max: 0.9 },
    heal: { min: 0.8, max: 1.2 },
    shield: { min: 0.9, max: 1.1 },
    double_power: { min: 1.8, max: 2.2 },
    fusion_boost: { min: 1.5, max: 1.8 }
};

function getRandomEffect(card) {
    const rarity = card.rarity.toLowerCase();
    const effectConfig = BATTLE_EFFECTS[rarity];
    
    if (!effectConfig || Math.random() > effectConfig.probability) {
        return null;
    }

    if (card.special) {
        const allEffects = Object.keys(EFFECT_MULTIPLIERS);
        return allEffects[Math.floor(Math.random() * allEffects.length)];
    }

    return effectConfig.effects[Math.floor(Math.random() * effectConfig.effects.length)];
}

function applyEffect(power, effect, isOwnEffect = true) {
    if (!effect) return power;

    const multiplier = EFFECT_MULTIPLIERS[effect];
    if (!multiplier) return power;

    let effectPower = power * (Math.random() * (multiplier.max - multiplier.min) + multiplier.min);

    if (effect === 'power_reduction' && isOwnEffect) {
        effectPower = power * 0.5;
    }

    const randomVariation = 0.8 + Math.random() * 0.4;
    return Math.round(effectPower * randomVariation);
}

function calculateBattlePower(card, ownEffect, opponentEffect) {
    let power = card.power;

    power = applyEffect(power, ownEffect, true);
    power = applyEffect(power, opponentEffect, false);

    return power;
}

const data = new SlashCommandSubcommandBuilder()
    .setName('accept')
    .setDescription('Accept a battle challenge');

async function execute(interaction) {
    await interaction.deferReply();

    const userId = interaction.user.id;

    try {
        const pendingBattle = await Battle.findOne({
            defenderId: userId,
            status: 'pending'
        });

        if (!pendingBattle) {
            return interaction.editReply('You don\'t have any pending battles to accept.');
        }

        const defenderCollection = await UserCollection.findOne({ userId })
            .populate({
                path: 'cards.cardId',
                refPath: 'cards.cardType'
            });
        if (!defenderCollection) {
            return interaction.editReply('You don\'t have any cards in your collection.');
        }

        const defenderCard = defenderCollection.cards.find(c => 
            c.cardId && c.cardId.toString() === pendingBattle.defenderCardId.toString() && 
            c.cardType === pendingBattle.defenderCardType
        );
        if (!defenderCard) {
            return interaction.editReply('The card you selected for battle is no longer in your collection.');
        }

        let populatedDefenderCard;
        if (defenderCard.cardType === 'Card') {
            populatedDefenderCard = await Card.findById(defenderCard.cardId);
        } else if (defenderCard.cardType === 'FusedCard') {
            populatedDefenderCard = await FusedCard.findById(defenderCard.cardId);
        }

        if (!populatedDefenderCard) {
            return interaction.editReply('Error: Could not find your battle card in the database.');
        }

        pendingBattle.defenderCard = {
            cardId: defenderCard.cardId,
            cardType: defenderCard.cardType,
            power: populatedDefenderCard.power,
            rarity: populatedDefenderCard.rarity,
            special: defenderCard.special
        };
        pendingBattle.status = 'active';
        await pendingBattle.save();

        const challengerCollection = await UserCollection.findOne({ userId: pendingBattle.challengerId })
            .populate({
                path: 'cards.cardId',
                refPath: 'cards.cardType'
            });
        if (!challengerCollection) {
            return interaction.editReply('Error: Challenger\'s collection not found.');
        }

        const challengerCard = challengerCollection.cards.find(c => 
            c.cardId && c.cardId.toString() === pendingBattle.challengerCardId.toString() && 
            c.cardType === pendingBattle.challengerCardType
        );
        if (!challengerCard) {
            return interaction.editReply('Error: Challenger\'s battle card not found.');
        }

        let challengerWins = 0;
        let defenderWins = 0;
        const rounds = [];

        for (let round = 1; round <= 3; round++) {
            const challengerEffect = getRandomEffect(populatedChallengerCard);
            const defenderEffect = getRandomEffect(populatedDefenderCard);

            const challengerPower = calculateBattlePower(populatedChallengerCard, challengerEffect, defenderEffect);
            const defenderPower = calculateBattlePower(populatedDefenderCard, defenderEffect, challengerEffect);

            const roundWinner = challengerPower > defenderPower ? 'challenger' : 'defender';
            if (roundWinner === 'challenger') challengerWins++;
            else defenderWins++;

            pendingBattle.rounds.push({
                round,
                challengerPower,
                defenderPower,
                challengerEffect,
                defenderEffect,
                winner: roundWinner
            });

            rounds.push({
                round,
                challengerPower,
                defenderPower,
                challengerEffect,
                defenderEffect,
                winner: roundWinner
            });

            if (challengerWins >= 2 || defenderWins >= 2) break;
        }

        const finalWinner = challengerWins > defenderWins ? 'challenger' : 'defender';
        pendingBattle.winner = finalWinner;
        pendingBattle.status = 'completed';
        await pendingBattle.save();

        const loserCollection = finalWinner === 'challenger' ? defenderCollection : challengerCollection;
        const winnerCollection = finalWinner === 'challenger' ? challengerCollection : defenderCollection;
        const losingCard = finalWinner === 'challenger' ? defenderCard : challengerCard;

        const cardToTransfer = {
            cardId: losingCard.cardId,
            quantity: 1,
            special: false
        };

        const cardIndex = loserCollection.cards.findIndex(c => c.cardId.toString() === losingCard.cardId.toString());
        if (cardIndex === -1) {
            return interaction.editReply('Error: Could not find the losing card in the collection.');
        }

        loserCollection.cards[cardIndex].quantity--;
        if (loserCollection.cards[cardIndex].quantity <= 0) {
            loserCollection.cards.splice(cardIndex, 1);
        }

        const existingCard = winnerCollection.cards.find(c => c.cardId.toString() === losingCard.cardId.toString());
        if (existingCard) {
            existingCard.quantity++;
        } else {
            winnerCollection.cards.push(cardToTransfer);
        }

        await Promise.all([
            loserCollection.save(),
            winnerCollection.save()
        ]);

        const embed = new MessageEmbed()
            .setColor('#FFD700')
            .setTitle('🏆 Battle Results 🏆')
            .setDescription(`Battle between ${interaction.client.users.cache.get(pendingBattle.challengerId)?.username || 'Challenger'} and ${interaction.user.username} has concluded!`)
            .addFields(
                { name: 'Winner', value: finalWinner === 'challenger' ? interaction.client.users.cache.get(pendingBattle.challengerId)?.username || 'Challenger' : interaction.user.username, inline: true },
                { name: 'Score', value: `${challengerWins}-${defenderWins}`, inline: true }
            );

        for (const round of rounds) {
            const challengerEffectText = round.challengerEffect ? `\nEffect: ${round.challengerEffect}` : '';
            const defenderEffectText = round.defenderEffect ? `\nEffect: ${round.defenderEffect}` : '';
            
            embed.addFields({
                name: `Round ${round.round}`,
                value: `Challenger: ${round.challengerPower}${challengerEffectText}\nDefender: ${round.defenderPower}${defenderEffectText}\nWinner: ${round.winner === 'challenger' ? interaction.client.users.cache.get(pendingBattle.challengerId)?.username || 'Challenger' : interaction.user.username}`
            });
        }

        embed.addFields({
            name: 'Card Transfer',
            value: `The losing card has been transferred to ${finalWinner === 'challenger' ? interaction.client.users.cache.get(pendingBattle.challengerId)?.username || 'Challenger' : interaction.user.username}'s collection.`
        });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in accept command:', error);
        await interaction.editReply('An error occurred while processing the battle.');
    }
}

module.exports = { data, execute }; 