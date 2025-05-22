const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const Card = require('../../models/Card');
const FusedCard = require('../../models/FusedCard');
const UserCollection = require('../../models/UserCollection');
const mongoose = require('mongoose');

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

async function execute(interaction) {
    await interaction.deferReply();

    const card1Name = interaction.options.getString('card1');
    const card2Name = interaction.options.getString('card2');
    const userId = interaction.user.id;

    try {
        const card1 = await Card.findOne({ name: card1Name });
        const card2 = await Card.findOne({ name: card2Name });

        if (!card1 || !card2) {
            return interaction.editReply('One or both cards not found in the database.');
        }

        const userCollection = await UserCollection.findOne({ userId });
        if (!userCollection) {
            return interaction.editReply('You don\'t have any cards in your collection.');
        }

        const card1Id = card1._id.toString();
        const card2Id = card2._id.toString();

        const card1InCollection = userCollection.cards.find(c => c.cardId.toString() === card1Id);
        const card2InCollection = userCollection.cards.find(c => c.cardId.toString() === card2Id);

        if (!card1InCollection || !card2InCollection) {
            return interaction.editReply('You don\'t have both cards in your collection.');
        }

        console.log(`Card 1 (${card1Name}) quantity: ${card1InCollection.quantity}`);
        console.log(`Card 2 (${card2Name}) quantity: ${card2InCollection.quantity}`);

        if (card1InCollection.quantity < 10 || card2InCollection.quantity < 10) {
            return interaction.editReply(`You need at least 10 copies of each card to perform a fusion. You have ${card1InCollection.quantity} copies of ${card1Name} and ${card2InCollection.quantity} copies of ${card2Name}.`);
        }

        const fusedName = generateFusedName(card1.name, card2.name);

        const fusedCard = new FusedCard({
            name: fusedName,
            rarity: 'fused',
            imageUrl: card1.imageUrl,
            description: `A custom mutation by ${interaction.user.username}`,
            set: 'Fusion',
            power: card1.power + card2.power,
            fusedBy: userId,
            parentCards: [
                { cardId: card1._id, quantity: 10 },
                { cardId: card2._id, quantity: 10 }
            ],
            special: false
        });

        const savedFusedCard = await fusedCard.save();

        const cardReference = new Card({
            _id: savedFusedCard._id,
            name: savedFusedCard.name,
            rarity: savedFusedCard.rarity,
            imageUrl: savedFusedCard.imageUrl,
            description: savedFusedCard.description,
            set: savedFusedCard.set,
            power: savedFusedCard.power,
            special: false
        });

        await cardReference.save();

        card1InCollection.quantity -= 10;
        card2InCollection.quantity -= 10;

        userCollection.cards.push({
            cardId: savedFusedCard._id,
            quantity: 1,
            special: false
        });

        userCollection.cards = userCollection.cards.filter(c => c.quantity > 0);

        await userCollection.save();

        const embed = new MessageEmbed()
            .setColor('#FFD700')
            .setTitle('🎉 Card Fusion Successful! 🎉')
            .setDescription(`You have successfully fused ${card1.name} and ${card2.name}!`)
            .addFields(
                { name: 'New Card', value: savedFusedCard.name, inline: true },
                { name: 'Power', value: savedFusedCard.power.toString(), inline: true },
                { name: 'Rarity', value: savedFusedCard.rarity, inline: true },
                { name: 'Description', value: savedFusedCard.description }
            )
            .setImage(savedFusedCard.imageUrl)
            .setFooter({ text: `Created by ${interaction.user.username}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error in fuse command:', error);
        await interaction.editReply('An error occurred while trying to fuse the cards.');
    }
}

module.exports = { data, execute }; 