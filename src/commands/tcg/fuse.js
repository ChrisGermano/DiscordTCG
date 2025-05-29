const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const Card = require('../../models/Card');
const FusedCard = require('../../models/FusedCard');
const UserCollection = require('../../models/UserCollection');
const mongoose = require('mongoose');
const User = require('../../models/User');
const fetch = require('node-fetch');

function findLongestCommonEnding(str1, str2) {
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    
    if (words1.length === 0 || words2.length === 0) return '';
    
    let commonEnding = '';
    let i = words1.length - 1;
    let j = words2.length - 1;
    
    while (i >= 0 && j >= 0 && words1[i].toLowerCase() === words2[j].toLowerCase()) {
        commonEnding = words1[i] + (commonEnding ? ' ' + commonEnding : '');
        i--;
        j--;
    }
    
    return commonEnding;
}

function generateFusedName(name1, name2) {
    const commonEnding = findLongestCommonEnding(name1, name2);
    
    if (commonEnding) {
        const name1WithoutEnding = name1.slice(0, name1.length - commonEnding.length).trim();
        if (!name1WithoutEnding) return name2;
        return `${name1WithoutEnding} ${name2}`;
    }
    
    return `${name1} ${name2}`;
}

const data = new SlashCommandSubcommandBuilder()
    .setName('fuse')
    .setDescription('Fuse two cards to create a unique variant.')
    .addStringOption(option =>
        option.setName('card1')
            .setDescription('Name of the first card to fuse')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('card2')
            .setDescription('Name of the second card to fuse')
            .setRequired(true));

async function generateCardImage(cardName) {
    try {
        const response = await fetch('https://pixelateimage.org/api/coze-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: cardName,
                aspectRatio: "1:1",
                pixelStyle: "Retro 8-bit Pixel Art",
                colorPalette: "Game Boy (Original)",
                compositionStyle: "Portrait Shot"
            })
        });

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.imageUrl) {
            throw new Error('No image URL in response');
        }

        return data.imageUrl;
    } catch (error) {
        console.error('Error generating card image:', error);
        throw error;
    }
}

async function checkFusion(card1, card2, userId) {
    console.log('Starting fusion check with cards:', {
        card1: { id: card1._id, name: card1.name, rarity: card1.rarity, set: card1.set, special: card1.special },
        card2: { id: card2._id, name: card2.name, rarity: card2.rarity, set: card2.set, special: card2.special }
    });

    // Check if either card is already a fused card
    if (card1.special || card2.special) {
        console.log('Fusion failed: One or both cards are already fused');
        return {
            canFuse: false,
            message: 'Fused cards cannot be used in fusion!'
        };
    }

    // Check if cards are the same
    if (card1._id.toString() === card2._id.toString()) {
        console.log('Fusion failed: Attempting to fuse card with itself');
        return {
            canFuse: false,
            message: 'You cannot fuse a card with itself!'
        };
    }

    // Check if cards are from the same set
    if (card1.set !== card2.set) {
        console.log('Fusion failed: Cards are from different sets', {
            card1Set: card1.set,
            card2Set: card2.set
        });
        return {
            canFuse: false,
            message: 'Cards must be from the same set to fuse!'
        };
    }

    // Check if cards are of the same rarity
    if (card1.rarity !== card2.rarity) {
        console.log('Fusion failed: Cards are of different rarities', {
            card1Rarity: card1.rarity,
            card2Rarity: card2.rarity
        });
        return {
            canFuse: false,
            message: 'Cards must be of the same rarity to fuse!'
        };
    }

    // Generate fused card name
    const fusedName = generateFusedName(card1.name, card2.name);
    console.log('Generated fused card name:', fusedName);

    // Check if this fusion already exists
    console.log('Checking for existing fusion with parent cards:', [card1._id, card2._id]);
    let fusedCard = await FusedCard.findOne({
        parentCards: {
            $all: [card1._id, card2._id]
        }
    });

    if (fusedCard) {
        console.log('Found existing fused card:', {
            id: fusedCard._id,
            name: fusedCard.name,
            rarity: fusedCard.rarity,
            set: fusedCard.set
        });
    } else {
        console.log('No existing fusion found, creating new fused card');
        try {
            // Generate image for the fused card
            console.log('Generating image for fused card:', fusedName);
            const imageUrl = await generateCardImage(fusedName);

            fusedCard = new FusedCard({
                name: fusedName,
                description: `A special fusion of ${card1.name} and ${card2.name}.`,
                rarity: 'fused', // Must be 'fused' as per schema
                set: 'Fusion', // Default set for fused cards
                special: true,
                power: Math.floor((card1.power + card2.power) * 1.5),
                fusedBy: userId,
                imageUrl: imageUrl,
                parentCards: [
                    {
                        cardId: card1._id,
                        quantity: 1
                    },
                    {
                        cardId: card2._id,
                        quantity: 1
                    }
                ]
            });
            
            console.log('Created new fused card object:', {
                name: fusedCard.name,
                description: fusedCard.description,
                rarity: fusedCard.rarity,
                set: fusedCard.set,
                special: fusedCard.special,
                parentCards: fusedCard.parentCards,
                power: fusedCard.power,
                fusedBy: fusedCard.fusedBy,
                imageUrl: fusedCard.imageUrl
            });

            await fusedCard.save();
            console.log('Successfully saved fused card to database with ID:', fusedCard._id);
        } catch (error) {
            console.error('Error creating/saving fused card:', error);
            throw error;
        }
    }

    console.log('Fusion check completed successfully');
    return {
        canFuse: true,
        fusedCard: fusedCard
    };
}

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const userId = interaction.user.id;
        let user = await User.findOne({ userId });
        let userCollection = await UserCollection.findOne({ userId })
            .populate('cards.cardId'); // Populate the card data

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

        const card1Name = interaction.options.getString('card1');
        const card2Name = interaction.options.getString('card2');

        // Find the cards in the user's collection
        const card1 = userCollection.cards.find(c => 
            c.cardId && c.cardId.name.toLowerCase() === card1Name.toLowerCase()
        );
        const card2 = userCollection.cards.find(c => 
            c.cardId && c.cardId.name.toLowerCase() === card2Name.toLowerCase()
        );

        if (!card1 || !card2) {
            return await interaction.editReply('One or both cards not found in your collection!');
        }

        if (card1.quantity < 1 || card2.quantity < 1) {
            return await interaction.editReply('You don\'t have enough copies of one or both cards to fuse!');
        }

        // Update the checkFusion call to include userId
        const fusionResult = await checkFusion(card1.cardId, card2.cardId, userId);
        if (!fusionResult.canFuse) {
            return await interaction.editReply(fusionResult.message);
        }

        // Remove the cards being fused
        card1.quantity -= 1;
        card2.quantity -= 1;
        if (card1.quantity === 0) {
            userCollection.cards = userCollection.cards.filter(c => c.cardId.toString() !== card1.cardId.toString());
        }
        if (card2.quantity === 0) {
            userCollection.cards = userCollection.cards.filter(c => c.cardId.toString() !== card2.cardId.toString());
        }

        // Add the fused card
        const existingFusedCard = userCollection.cards.find(c => 
            c.cardId && c.cardId.toString() === fusionResult.fusedCard._id.toString() && 
            c.cardType === 'FusedCard'
        );
        if (existingFusedCard) {
            existingFusedCard.quantity += 1;
        } else {
            userCollection.cards.push({
                cardId: fusionResult.fusedCard._id,
                cardType: 'FusedCard',
                quantity: 1,
                special: true
            });
        }

        // Award XP for fusing
        const xpResult = await user.addXp(100); // Award 100 XP for fusing

        await userCollection.save();

        // Create embed for response
        const embed = {
            color: getRarityColor('fused'),
            title: '✨ Fusion Results',
            description: 'You successfully fused your cards!',
            fields: [
                {
                    name: 'Cards Fused',
                    value: `${getRarityEmoji(card1.cardId.rarity)} **${card1.cardId.name}**\n${getRarityEmoji(card2.cardId.rarity)} **${card2.cardId.name}**`,
                    inline: true
                },
                {
                    name: 'New Card',
                    value: `${getRarityEmoji('fused')} **${fusionResult.fusedCard.name}** (Fused)`,
                    inline: true
                },
                {
                    name: 'Experience Gained',
                    value: `+${xpResult.xpGained} XP${xpResult.newLevel > user.level ? `\n🎉 Level Up! You are now level ${xpResult.newLevel}!` : ''}`,
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
        console.error('Error in /tcg fuse command:', error);
        await interaction.editReply('There was an error fusing your cards. Please try again later.');
    }
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

function getRarityColor(rarity) {
    const colors = {
        common: 0x808080,    // Gray
        uncommon: 0x00FF00,  // Green
        rare: 0x0000FF,      // Blue
        legendary: 0xFFD700, // Gold
        fused: 0xFF00FF      // Purple
    };
    return colors[rarity] || 0x808080;
}

module.exports = { data, execute }; 