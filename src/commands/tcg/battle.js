const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const UserCollection = require('../../models/UserCollection');
const { Card, TYPE_STRENGTHS } = require('../../models/Card');

const data = new SlashCommandSubcommandBuilder()
    .setName('battle')
    .setDescription('Start a battle against a bot enemy')
    .addStringOption(option =>
        option.setName('card')
            .setDescription('The card you want to use in battle')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('difficulty')
            .setDescription('The difficulty level of the battle')
            .setRequired(true)
            .addChoices(
                { name: 'Easy', value: 'easy' },
                { name: 'Medium', value: 'medium' },
                { name: 'Hard', value: 'hard' }
            ));

// Define rarity progression for enemy cards based on player card rarity and difficulty
const ENEMY_RARITY_MAP = {
    common: {
        easy: 'common',
        medium: 'common',
        hard: 'uncommon'
    },
    uncommon: {
        easy: 'common',
        medium: 'uncommon',
        hard: 'rare'
    },
    rare: {
        easy: 'uncommon',
        medium: 'rare',
        hard: 'legendary'
    },
    legendary: {
        easy: 'rare',
        medium: 'legendary',
        hard: 'deity'
    },
    deity: {
        easy: 'legendary',
        medium: 'deity',
        hard: 'deity'
    }
};

// Define battle conditions
const BATTLE_CONDITIONS = {
    'Blood Moon': {
        type: 'Blood',
        description: 'The battlefield is bathed in crimson light, empowering Blood cards',
        affectedType: 'Blood'
    },
    'Psionic Storm': {
        type: 'Mind',
        description: 'A swirling vortex of psychic energy amplifies Mind cards',
        affectedType: 'Mind'
    },
    'Time Dilation': {
        type: 'Time',
        description: 'Time flows differently here, enhancing Time cards',
        affectedType: 'Time'
    },
    'Techno Surge': {
        type: 'Tech',
        description: 'Electromagnetic interference boosts Tech cards',
        affectedType: 'Tech'
    },
    'Mana Surge': {
        type: 'Arcane',
        description: 'Raw magical energy erupts from the ground, empowering Arcane cards',
        affectedType: 'Arcane'
    },
    'Death\'s Embrace': {
        type: 'Necrotic',
        description: 'The veil between life and death thins, strengthening Necrotic cards',
        affectedType: 'Necrotic'
    }
};

// Battle system constants
const BATTLE_CONSTANTS = {
    TYPE_ADVANTAGE_MULTIPLIER: 1.5,  // Damage multiplier for type advantage
    TYPE_DISADVANTAGE_MULTIPLIER: 0.75,  // Damage multiplier for type disadvantage
    BATTLE_CONDITION_MULTIPLIER: 1.25,  // Damage multiplier for battle condition
    CRITICAL_HIT_CHANCE: 0.1,  // 10% chance for critical hit
    CRITICAL_HIT_MULTIPLIER: 1.5,  // Critical hit damage multiplier
    MAX_TURNS: 10,  // Maximum number of turns before battle ends
    // Health multipliers based on rarity
    HEALTH_MULTIPLIERS: {
        common: 1.0,      // Base health
        uncommon: 1.2,    // 20% more health
        rare: 1.5,        // 50% more health
        legendary: 2.0,   // Double health
        deity: 3.0,       // Triple health
        fused: 1.8        // 80% more health
    },
    BATTLE_CONDITION_HEALTH_MULTIPLIER: 1.3,  // 30% more health when affected by battle condition
    DAMAGE_VARIANCE: 0.1,  // ±10% random variance in damage
    // Credit reward multipliers based on difficulty
    CREDIT_MULTIPLIERS: {
        easy: 0.4,    // 40% of enemy power
        medium: 0.8,  // 80% of enemy power
        hard: 1.5     // 150% of enemy power
    }
};

function getTypeAdvantage(attackerType, defenderType) {
    if (!attackerType || !defenderType) return null;
    
    const attackerStrengths = TYPE_STRENGTHS[attackerType].strong;
    const attackerWeaknesses = TYPE_STRENGTHS[attackerType].weak;
    
    if (attackerStrengths.includes(defenderType)) {
        return 'strong';
    } else if (attackerWeaknesses.includes(defenderType)) {
        return 'weak';
    }
    return 'neutral';
}

function getTypeEmoji(type) {
    const emojis = {
        'Blood': '🩸',
        'Mind': '🧠',
        'Time': '⏳',
        'Tech': '⚡',
        'Arcane': '✨',
        'Necrotic': '💀',
        'Deity': '🌟'
    };
    return emojis[type] || '❓';
}

function calculateStartingHealth(card, battleCondition) {
    // Base health is the card's power
    let health = card.power || 0;
    
    // Apply rarity multiplier
    const rarityMultiplier = BATTLE_CONSTANTS.HEALTH_MULTIPLIERS[card.rarity] || 1.0;
    health *= rarityMultiplier;
    
    // Apply battle condition bonus if applicable
    if (battleCondition && card.type === battleCondition.affectedType) {
        health *= BATTLE_CONSTANTS.BATTLE_CONDITION_HEALTH_MULTIPLIER;
    }
    
    // Round the final health value
    return Math.round(health);
}

function calculateDamage(attacker, defender, attackerType, defenderType, battleCondition) {
    // Base damage is the attacker's power
    let damage = attacker.power || 0;
    
    // Apply type advantage/disadvantage
    const typeEffectiveness = getTypeAdvantage(attackerType, defenderType);
    if (typeEffectiveness === 'strong') {
        damage *= BATTLE_CONSTANTS.TYPE_ADVANTAGE_MULTIPLIER;
    } else if (typeEffectiveness === 'weak') {
        damage *= BATTLE_CONSTANTS.TYPE_DISADVANTAGE_MULTIPLIER;
    }
    
    // Apply battle condition bonus
    if (battleCondition && attackerType === battleCondition.affectedType) {
        damage *= BATTLE_CONSTANTS.BATTLE_CONDITION_MULTIPLIER;
    }
    
    // Check for critical hit
    const isCritical = Math.random() < BATTLE_CONSTANTS.CRITICAL_HIT_CHANCE;
    if (isCritical) {
        damage *= BATTLE_CONSTANTS.CRITICAL_HIT_MULTIPLIER;
    }
    
    // Apply random variance (±10%)
    const variance = 1 + (Math.random() * BATTLE_CONSTANTS.DAMAGE_VARIANCE * 2 - BATTLE_CONSTANTS.DAMAGE_VARIANCE);
    damage *= variance;
    
    // Round down the final damage to nearest integer
    return {
        damage: Math.floor(damage),
        isCritical,
        typeEffectiveness,
        variance: Math.round(variance * 100) / 100  // Round to 2 decimal places for display
    };
}

async function simulateBattle(playerCard, enemyCard, battleCondition, userCollection, difficulty) {
    // Calculate starting health with multipliers
    let playerHealth = calculateStartingHealth(playerCard, battleCondition);
    let enemyHealth = calculateStartingHealth(enemyCard, battleCondition);
    let turn = 1;
    let battleLog = [];
    
    // Add initial battle state with health multipliers info
    let healthInfo = `**Battle Start!**\n`;
    healthInfo += `Player Health: ${playerHealth} (${playerCard.rarity.charAt(0).toUpperCase() + playerCard.rarity.slice(1)})\n`;
    if (battleCondition && playerCard.type === battleCondition.affectedType) {
        healthInfo += `✨ Empowered by ${battleCondition.type} condition!\n`;
    }
    healthInfo += `Enemy Health: ${enemyHealth} (${enemyCard.rarity.charAt(0).toUpperCase() + enemyCard.rarity.slice(1)})\n`;
    if (battleCondition && enemyCard.type === battleCondition.affectedType) {
        healthInfo += `✨ Empowered by ${battleCondition.type} condition!\n`;
    }
    battleLog.push(healthInfo);
    
    while (turn <= BATTLE_CONSTANTS.MAX_TURNS && playerHealth > 0 && enemyHealth > 0) {
        // Player's turn
        const playerAttack = calculateDamage(
            playerCard,
            enemyCard,
            playerCard.type,
            enemyCard.type,
            battleCondition
        );
        
        enemyHealth -= playerAttack.damage;
        if (enemyHealth < 0) enemyHealth = 0;
        
        let turnLog = `**Turn ${turn} - Player's Attack**\n`;
        turnLog += `${playerCard.name} attacks ${enemyCard.name}!\n`;
        if (playerAttack.isCritical) {
            turnLog += "💥 Critical Hit! ";
        }
        if (playerAttack.typeEffectiveness === 'strong') {
            turnLog += "✨ Type Advantage! ";
        } else if (playerAttack.typeEffectiveness === 'weak') {
            turnLog += "⚠️ Type Disadvantage! ";
        }
        if (battleCondition && playerCard.type === battleCondition.affectedType) {
            turnLog += "🌟 Battle Condition Bonus! ";
        }
        turnLog += `\nDealt ${playerAttack.damage} damage! (${playerAttack.variance}x variance)\n`;
        turnLog += `Enemy Health: ${enemyHealth}\n`;
        battleLog.push(turnLog);
        
        if (enemyHealth <= 0) break;
        
        // Enemy's turn
        const enemyAttack = calculateDamage(
            enemyCard,
            playerCard,
            enemyCard.type,
            playerCard.type,
            battleCondition
        );
        
        playerHealth -= enemyAttack.damage;
        if (playerHealth < 0) playerHealth = 0;
        
        turnLog = `**Turn ${turn} - Enemy's Attack**\n`;
        turnLog += `${enemyCard.name} attacks ${playerCard.name}!\n`;
        if (enemyAttack.isCritical) {
            turnLog += "💥 Critical Hit! ";
        }
        if (enemyAttack.typeEffectiveness === 'strong') {
            turnLog += "✨ Type Advantage! ";
        } else if (enemyAttack.typeEffectiveness === 'weak') {
            turnLog += "⚠️ Type Disadvantage! ";
        }
        if (battleCondition && enemyCard.type === battleCondition.affectedType) {
            turnLog += "🌟 Battle Condition Bonus! ";
        }
        turnLog += `\nDealt ${enemyAttack.damage} damage! (${enemyAttack.variance}x variance)\n`;
        turnLog += `Player Health: ${playerHealth}\n`;
        battleLog.push(turnLog);
        
        turn++;
    }
    
    // Determine battle outcome and handle rewards/penalties
    let outcome;
    let rewards = null;
    let penalties = null;
    
    if (playerHealth <= 0 && enemyHealth <= 0) {
        outcome = "The battle ended in a draw!";
    } else if (playerHealth <= 0) {
        outcome = "You were defeated!";
        // Remove one copy of the card from collection
        const cardIndex = userCollection.cards.findIndex(c => 
            c.cardId && c.cardId._id.toString() === playerCard._id.toString()
        );
        
        if (cardIndex !== -1) {
            if (userCollection.cards[cardIndex].quantity > 1) {
                userCollection.cards[cardIndex].quantity -= 1;
            } else {
                userCollection.cards.splice(cardIndex, 1);
            }
            await userCollection.save();
            penalties = `You lost one copy of ${playerCard.name}!`;
        }
    } else if (enemyHealth <= 0) {
        outcome = "You won the battle!";
        // Award credits based on enemy's power and difficulty
        const baseCredits = enemyCard.power;
        const multiplier = BATTLE_CONSTANTS.CREDIT_MULTIPLIERS[difficulty];
        const creditsEarned = Math.floor(baseCredits * multiplier);
        userCollection.credits += creditsEarned;
        await userCollection.save();
        rewards = `You earned ${creditsEarned} credit${creditsEarned === 1 ? '' : 's'}! (${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} difficulty: ${multiplier}x multiplier)`;
    } else {
        outcome = "The battle reached the maximum number of turns!";
    }
    
    // Add outcome and rewards/penalties to battle log
    let endMessage = `\n**Battle End**\n${outcome}`;
    if (rewards) {
        endMessage += `\n${rewards}`;
    }
    if (penalties) {
        endMessage += `\n${penalties}`;
    }
    battleLog.push(endMessage);
    
    return {
        battleLog,
        winner: playerHealth > enemyHealth ? 'player' : enemyHealth > playerHealth ? 'enemy' : 'draw',
        turns: turn - 1,
        rewards,
        penalties
    };
}

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const cardName = interaction.options.getString('card');
        const difficulty = interaction.options.getString('difficulty');
        
        // Get user's collection and find their card
        const userCollection = await UserCollection.findOne({ userId: interaction.user.id })
            .populate({
                path: 'cards.cardId',
                refPath: 'cards.cardType'
            });

        if (!userCollection) {
            await interaction.editReply('You don\'t have any cards in your collection!');
            return;
        }

        // Find the player's card
        const playerCard = userCollection.cards.find(c => 
            c.cardId && 
            c.cardId.name.toLowerCase() === cardName.toLowerCase() && 
            c.quantity > 0
        );

        if (!playerCard || !playerCard.cardId) {
            await interaction.editReply(`You don't have a card named "${cardName}" in your collection!`);
            return;
        }

        // Get the appropriate enemy rarity based on player's card rarity and difficulty
        const playerRarity = playerCard.cardId.rarity;
        const enemyRarity = ENEMY_RARITY_MAP[playerRarity][difficulty];

        // Get a random enemy card of the appropriate rarity
        const enemyCard = await Card.aggregate([
            { $match: { rarity: enemyRarity } },
            { $sample: { size: 1 } }
        ]).then(results => results[0]);

        if (!enemyCard) {
            await interaction.editReply('There was an error generating an enemy. Please try again later.');
            return;
        }

        // Select a random battle condition
        const conditionNames = Object.keys(BATTLE_CONDITIONS);
        const randomCondition = BATTLE_CONDITIONS[conditionNames[Math.floor(Math.random() * conditionNames.length)]];

        // Calculate type advantages
        const playerToEnemy = getTypeAdvantage(playerCard.cardId.type, enemyCard.type);
        const enemyToPlayer = getTypeAdvantage(enemyCard.type, playerCard.cardId.type);

        // Create initial battle message
        let message = `**Battle Initiated!**\n\n`;
        message += `**Battle Rules:**\n`;
        message += `• If you win, you'll earn credits based on the enemy's power:\n`;
        message += `  - Easy: ${BATTLE_CONSTANTS.CREDIT_MULTIPLIERS.easy}x enemy power\n`;
        message += `  - Medium: ${BATTLE_CONSTANTS.CREDIT_MULTIPLIERS.medium}x enemy power\n`;
        message += `  - Hard: ${BATTLE_CONSTANTS.CREDIT_MULTIPLIERS.hard}x enemy power\n`;
        message += `• If you lose, you'll lose one copy of your chosen card\n\n`;
        
        // Battle condition
        message += `**Battle Condition:** ${randomCondition.description}\n`;
        message += `This condition empowers ${randomCondition.affectedType} type cards!\n\n`;
        
        // Player card details
        message += `**Your Card:**\n`;
        message += `Name: ${playerCard.cardId.name}\n`;
        message += `Type: ${getTypeEmoji(playerCard.cardId.type)} ${playerCard.cardId.type}\n`;
        message += `Power: ${playerCard.cardId.power}\n\n`;
        
        // Enemy card details
        message += `**Enemy Card:**\n`;
        message += `Name: ${enemyCard.name}\n`;
        message += `Type: ${getTypeEmoji(enemyCard.type)} ${enemyCard.type}\n`;
        message += `Power: ${enemyCard.power}\n\n`;
        
        // Type advantage analysis
        message += `**Type Analysis:**\n`;
        if (playerToEnemy === 'strong') {
            message += `Your ${playerCard.cardId.type} type is strong against the enemy's ${enemyCard.type} type!\n`;
        } else if (playerToEnemy === 'weak') {
            message += `Your ${playerCard.cardId.type} type is weak against the enemy's ${enemyCard.type} type!\n`;
        }
        
        if (enemyToPlayer === 'strong') {
            message += `The enemy's ${enemyCard.type} type is strong against your ${playerCard.cardId.type} type!\n`;
        } else if (enemyToPlayer === 'weak') {
            message += `The enemy's ${enemyCard.type} type is weak against your ${playerCard.cardId.type} type!\n`;
        }
        
        if (playerToEnemy === 'neutral' && enemyToPlayer === 'neutral') {
            message += `Neither card has a type advantage.\n`;
        }

        // Add battle condition effect note
        if (playerCard.cardId.type === randomCondition.affectedType) {
            message += `\nYour card is empowered by the ${randomCondition.type} condition!`;
        } else if (enemyCard.type === randomCondition.affectedType) {
            message += `\nThe enemy card is empowered by the ${randomCondition.type} condition!`;
        }

        // Send initial battle setup
        await interaction.editReply(message);

        // Simulate the battle with userCollection and difficulty for rewards/penalties
        const battleResult = await simulateBattle(playerCard.cardId, enemyCard, randomCondition, userCollection, difficulty);
        
        // Send battle log in chunks to avoid message length limits
        for (let i = 0; i < battleResult.battleLog.length; i++) {
            if (i === 0) {
                await interaction.followUp({ content: battleResult.battleLog[i], ephemeral: true });
            } else {
                await interaction.followUp({ content: battleResult.battleLog[i], ephemeral: true });
            }
        }

    } catch (error) {
        console.error('Error in /tcg battle command:', error);
        await interaction.editReply('There was an error starting the battle. Please try again later.');
    }
}

module.exports = {
    data,
    execute
}; 