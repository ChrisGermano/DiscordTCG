const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const Battle = require('../../models/Battle');
const UserCollection = require('../../models/UserCollection');
const Card = require('../../models/Card');
const config = require('../../config/config');

// Battle effect probabilities based on rarity
const EFFECT_CHANCES = {
    common: {
        critical_hit: 0.05,
        defense_boost: 0.10,
        power_steal: 0.00,
        double_power: 0.00,
        shield: 0.05
    },
    uncommon: {
        critical_hit: 0.10,
        defense_boost: 0.15,
        power_steal: 0.05,
        double_power: 0.00,
        shield: 0.10
    },
    rare: {
        critical_hit: 0.15,
        defense_boost: 0.20,
        power_steal: 0.10,
        double_power: 0.05,
        shield: 0.15
    },
    legendary: {
        critical_hit: 0.20,
        defense_boost: 0.25,
        power_steal: 0.15,
        double_power: 0.10,
        shield: 0.20
    }
};

// Effect multipliers
const EFFECT_MULTIPLIERS = {
    critical_hit: 2.0,
    defense_boost: 1.5,
    power_steal: 1.3,
    double_power: 2.0,
    shield: 0.5,
    none: 1.0
};

function getRandomEffects(card) {
    const effects = [];
    const chances = EFFECT_CHANCES[card.rarity];
    
    // Special cards get an additional effect
    const maxEffects = card.special ? 2 : 1;
    
    for (const [effect, chance] of Object.entries(chances)) {
        if (Math.random() < chance && effects.length < maxEffects) {
            effects.push(effect);
        }
    }
    
    return effects.length > 0 ? effects : ['none'];
}

function calculateBattlePower(basePower, effects, opponentEffects) {
    let power = basePower;
    let defense = 0;
    
    // Apply own effects
    for (const effect of effects) {
        switch (effect) {
            case 'critical_hit':
                power *= EFFECT_MULTIPLIERS.critical_hit;
                break;
            case 'defense_boost':
                defense += basePower * (EFFECT_MULTIPLIERS.defense_boost - 1);
                break;
            case 'power_steal':
                power *= EFFECT_MULTIPLIERS.power_steal;
                break;
            case 'double_power':
                power *= EFFECT_MULTIPLIERS.double_power;
                break;
            case 'shield':
                defense += basePower * (1 - EFFECT_MULTIPLIERS.shield);
                break;
        }
    }
    
    // Apply opponent's effects that affect us
    for (const effect of opponentEffects) {
        if (effect === 'power_steal') {
            power *= (2 - EFFECT_MULTIPLIERS.power_steal);
        }
    }
    
    // Add some randomness (±20%)
    const randomFactor = 0.8 + (Math.random() * 0.4);
    power = Math.floor((power + defense) * randomFactor);
    
    return power;
}

function determineRoundWinner(challengerPower, defenderPower) {
    const totalPower = challengerPower + defenderPower;
    const challengerRoll = Math.random() * totalPower;
    return challengerRoll < challengerPower ? 'challenger' : 'defender';
}

const data = new SlashCommandSubcommandBuilder()
    .setName('accept')
    .setDescription('Accept a pending battle challenge')
    .addStringOption(option =>
        option.setName('card')
            .setDescription('The card to use in battle')
            .setRequired(true));

async function execute(interaction) {
    await interaction.deferReply();

    try {
        const cardName = interaction.options.getString('card');

        // Find pending battle where user is defender
        const battle = await Battle.findOne({
            defenderId: interaction.user.id,
            status: 'pending'
        }).populate('challengerCardId');

        if (!battle) {
            await interaction.editReply('You don\'t have any pending battle challenges!');
            return;
        }

        // Get defender's card
        const defenderCollection = await UserCollection.findOne({ userId: interaction.user.id })
            .populate('cards.cardId');
        
        const defenderCard = defenderCollection.cards.find(c => 
            c.cardId.name.toLowerCase() === cardName.toLowerCase() && 
            c.quantity > 0
        );

        if (!defenderCard) {
            await interaction.editReply(`You don't have "${cardName}" in your collection!`);
            return;
        }

        // Update battle with defender's card and start it
        battle.defenderCardId = defenderCard.cardId._id;
        battle.status = 'in_progress';
        await battle.save();

        // Get challenger's collection for card transfer
        const challengerCollection = await UserCollection.findOne({ userId: battle.challengerId })
            .populate('cards.cardId');

        const challengerCard = challengerCollection.cards.find(c => 
            c.cardId._id.toString() === battle.challengerCardId.toString()
        ).cardId;

        // Battle loop for best of three
        let roundResults = [];
        while (battle.currentRound <= 3 && 
               battle.challengerWins < 2 && 
               battle.defenderWins < 2) {
            
            // Get effects for this round
            const challengerEffects = getRandomEffects(challengerCard);
            const defenderEffects = getRandomEffects(defenderCard.cardId);
            
            // Calculate battle powers
            const challengerPower = calculateBattlePower(
                challengerCard.power,
                challengerEffects,
                defenderEffects
            );
            
            const defenderPower = calculateBattlePower(
                defenderCard.cardId.power,
                defenderEffects,
                challengerEffects
            );
            
            // Determine round winner
            const roundWinner = determineRoundWinner(challengerPower, defenderPower);
            
            // Update battle stats
            if (roundWinner === 'challenger') {
                battle.challengerWins++;
            } else {
                battle.defenderWins++;
            }
            
            // Record round
            battle.rounds.push({
                roundNumber: battle.currentRound,
                challengerPower,
                defenderPower,
                challengerEffects,
                defenderEffects,
                winner: roundWinner
            });
            
            battle.currentRound++;
            await battle.save();
            
            roundResults.push({
                round: battle.currentRound - 1,
                challengerPower,
                defenderPower,
                challengerEffects,
                defenderEffects,
                winner: roundWinner
            });
        }

        // Determine final winner
        battle.winnerId = battle.challengerWins > battle.defenderWins ? 
            battle.challengerId : battle.defenderId;
        battle.status = 'completed';
        await battle.save();

        // Transfer card from loser to winner
        const winnerCollection = await UserCollection.findOne({ userId: battle.winnerId });
        const loserCollection = await UserCollection.findOne({ 
            userId: battle.winnerId === battle.challengerId ? 
                battle.defenderId : battle.challengerId 
        });

        const loserCard = battle.winnerId === battle.challengerId ? 
            defenderCard.cardId : challengerCard;

        // Remove card from loser
        const loserCardEntry = loserCollection.cards.find(c => 
            c.cardId.toString() === loserCard._id.toString()
        );
        loserCardEntry.quantity -= 1;
        if (loserCardEntry.quantity === 0) {
            loserCollection.cards = loserCollection.cards.filter(c => c !== loserCardEntry);
        }
        await loserCollection.save();

        // Add card to winner
        const winnerCardEntry = winnerCollection.cards.find(c => 
            c.cardId.toString() === loserCard._id.toString()
        );
        if (winnerCardEntry) {
            winnerCardEntry.quantity += 1;
        } else {
            winnerCollection.cards.push({
                cardId: loserCard._id,
                quantity: 1,
                special: false // Keep the card as non-special when transferred
            });
        }
        await winnerCollection.save();

        // Create battle results embed
        let resultEmbed = {
            color: 0x00ff00,
            title: 'Battle Results!',
            description: 'The battle has concluded!',
            fields: [
                {
                    name: 'Challenger\'s Card',
                    value: `${challengerCard.name}\nPower: ${challengerCard.power}\nRarity: ${challengerCard.rarity}`
                },
                {
                    name: 'Defender\'s Card',
                    value: `${defenderCard.cardId.name}\nPower: ${defenderCard.cardId.power}\nRarity: ${defenderCard.cardId.rarity}`
                }
            ],
            timestamp: new Date()
        };

        // Add round details
        roundResults.forEach((round, index) => {
            const challengerEffectsText = round.challengerEffects
                .map(effect => effect.replace('_', ' ').toUpperCase())
                .join(', ');
            const defenderEffectsText = round.defenderEffects
                .map(effect => effect.replace('_', ' ').toUpperCase())
                .join(', ');

            resultEmbed.fields.push({
                name: `Round ${round.round}`,
                value: `Challenger: ${round.challengerPower} power (${challengerEffectsText})\n` +
                       `Defender: ${round.defenderPower} power (${defenderEffectsText})\n` +
                       `Winner: ${round.winner.toUpperCase()}`
            });
        });

        // Add final result
        resultEmbed.fields.push({
            name: 'Final Result',
            value: `<@${battle.winnerId}> has won the battle ${battle.challengerWins}-${battle.defenderWins} and claimed ${loserCard.name}!`
        });

        await interaction.editReply({ embeds: [resultEmbed] });

    } catch (error) {
        console.error('Error in /tcg accept command:', error);
        await interaction.editReply('There was an error processing the battle. Please try again later.');
    }
}

module.exports = {
    data,
    execute
}; 