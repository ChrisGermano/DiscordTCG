const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const Card = require('../../models/Card');
const FusedCard = require('../../models/FusedCard');
const UserCollection = require('../../models/UserCollection');
const mongoose = require('mongoose');
const User = require('../../models/User');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const { generateCardImage, getCardAutocompleteSuggestions } = require('../../utils/cardUtils');

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
    .setDescription('Fuse 10 copies of two cards to create a unique variant.')
    .addStringOption(option =>
        option.setName('card1')
            .setDescription('Name of the first card to fuse')
            .setRequired(true)
            .setAutocomplete(true))
    .addStringOption(option =>
        option.setName('card2')
            .setDescription('Name of the second card to fuse')
            .setRequired(true)
            .setAutocomplete(true));

async function autocomplete(interaction) {
    try {
        const focusedValue = interaction.options.getFocused();
        const suggestions = await getCardAutocompleteSuggestions(interaction.user.id, focusedValue, {
            includeFused: false // Don't allow fusing already fused cards
        });
        await interaction.respond(suggestions);
    } catch (error) {
        console.error('Error in fuse command autocomplete:', error);
        await interaction.respond([]);
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

async function addFusedCardToJson(fusedCard) {
    try {
        const jsonPath = path.join(__dirname, '../../data/fusedcards.json');
        const jsonData = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
        
        // Create a simplified version of the fused card for the JSON
        const fusedCardData = {
            id: fusedCard._id.toString(),
            name: fusedCard.name,
            description: fusedCard.description,
            rarity: fusedCard.rarity,
            set: fusedCard.set,
            power: fusedCard.power,
            imageUrl: fusedCard.imageUrl,
            fusedBy: fusedCard.fusedBy,
            parentCards: fusedCard.parentCards.map(parent => ({
                cardId: parent.cardId.toString(),
                quantity: parent.quantity
            })),
            createdAt: new Date().toISOString()
        };

        jsonData.fusedCards.push(fusedCardData);
        await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2));
    } catch (error) {
        console.error('Error writing to fusedcards.json:', error);
        // Don't throw the error - we don't want to break the fusion process if JSON writing fails
    }
}

async function execute(interaction) {
    await interaction.deferReply();

    try {
        const card1Name = interaction.options.getString('card1');
        const card2Name = interaction.options.getString('card2');
        const userId = interaction.user.id;

        // Find user's collection
        const userCollection = await UserCollection.findOne({ userId })
            .populate({
                path: 'cards.cardId',
                refPath: 'cards.cardType'
            });

        if (!userCollection) {
            return await interaction.editReply('You don\'t have any cards in your collection yet!');
        }

        // Find both cards in the user's collection
        const card1Entry = userCollection.cards.find(card => 
            card.cardId && card.cardId.name && card.cardId.name.toLowerCase() === card1Name.toLowerCase()
        );
        const card2Entry = userCollection.cards.find(card => 
            card.cardId && card.cardId.name && card.cardId.name.toLowerCase() === card2Name.toLowerCase()
        );

        if (!card1Entry || !card2Entry) {
            return await interaction.editReply('One or both cards not found in your collection!');
        }

        // Check if either card is already fused
        if (card1Entry.cardType === 'FusedCard' || card2Entry.cardType === 'FusedCard') {
            return await interaction.editReply('You cannot fuse cards that are already fused!');
        }

        // Check if trying to fuse the same card
        if (card1Entry.cardId._id.toString() === card2Entry.cardId._id.toString()) {
            return await interaction.editReply('You cannot fuse a card with itself!');
        }

        const card1 = card1Entry.cardId;
        const card2 = card2Entry.cardId;

        // Check if cards are from the same set
        if (card1.set !== card2.set) {
            return await interaction.editReply('You can only fuse cards from the same set!');
        }

        // Check if cards are of the same rarity
        if (card1.rarity !== card2.rarity) {
            return await interaction.editReply('You can only fuse cards of the same rarity!');
        }

        // Generate fused card name
        const fusedName = generateFusedName(card1.name, card2.name);

        // Check if this fusion already exists
        const existingFusion = await FusedCard.findOne({
            'parentCards.cardId': { 
                $all: [card1._id, card2._id]
            }
        });

        if (existingFusion) {
            // Check if user already has this fused card
            const existingUserFusion = userCollection.cards.find(card => 
                card.cardId && card.cardId._id.toString() === existingFusion._id.toString()
            );

            if (existingUserFusion) {
                existingUserFusion.quantity += 1;
            } else {
                userCollection.cards.push({
                    cardId: existingFusion._id,
                    cardType: 'FusedCard',
                    quantity: 1,
                    special: true
                });
            }

            await userCollection.save();

            // Remove the cards used for fusion
            card1Entry.quantity -= 1;
            card2Entry.quantity -= 1;

            // Remove cards with zero quantity
            userCollection.cards = userCollection.cards.filter(card => card.quantity > 0);
            await userCollection.save();

            // Award XP for fusing
            const user = await User.findOne({ userId });
            if (user) {
                await user.addXp(100); // Award 100 XP for fusing
            }

            return await interaction.editReply({
                content: `✅ Successfully fused ${card1.name} and ${card2.name} into ${existingFusion.name}!`,
            });
        }

        // Create new fused card
        const fusedCard = new FusedCard({
            name: fusedName,
            description: `A powerful fusion of ${card1.name} and ${card2.name}.`,
            rarity: 'fused', // Changed from card1.rarity to 'fused'
            set: card1.set,
            power: Math.max(card1.power || 0, card2.power || 0) + 10,
            imageUrl: card1.imageUrl,
            parentCards: [
                { cardId: card1._id, quantity: 1 },
                { cardId: card2._id, quantity: 1 }
            ],
            fusedBy: userId
        });

        await fusedCard.save();
        
        // Add the fused card to the JSON file
        await addFusedCardToJson(fusedCard);

        // Add the fused card to user's collection
        userCollection.cards.push({
            cardId: fusedCard._id,
            cardType: 'FusedCard',
            quantity: 1,
            special: true
        });

        // Remove the cards used for fusion
        card1Entry.quantity -= 1;
        card2Entry.quantity -= 1;

        // Remove cards with zero quantity
        userCollection.cards = userCollection.cards.filter(card => card.quantity > 0);
        await userCollection.save();

        // Award XP for fusing
        const user = await User.findOne({ userId });
        if (user) {
            await user.addXp(100); // Award 100 XP for fusing
        }

        await interaction.editReply({
            content: `✅ Successfully fused ${card1.name} and ${card2.name} into ${fusedCard.name}!`,
        });

    } catch (error) {
        console.error('Error in /tcg fuse command:', error);
        await interaction.editReply('There was an error fusing the cards. Please try again later.');
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

module.exports = {
    data,
    execute,
    autocomplete
}; 