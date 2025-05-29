const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const Card = require('../../models/Card');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

const data = new SlashCommandSubcommandBuilder()
    .setName('createcard')
    .setDescription('Create a new card (Admin only)')
    .addStringOption(option =>
        option.setName('name')
            .setDescription('The name of the card')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('rarity')
            .setDescription('The rarity of the card')
            .setRequired(true)
            .addChoices(
                { name: 'Common', value: 'common' },
                { name: 'Uncommon', value: 'uncommon' },
                { name: 'Rare', value: 'rare' },
                { name: 'Legendary', value: 'legendary' }
            ))
    .addStringOption(option =>
        option.setName('description')
            .setDescription('The description of the card')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('set')
            .setDescription('The set the card belongs to')
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName('power')
            .setDescription('The power value of the card')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100));

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

async function execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    try {
        const name = interaction.options.getString('name');
        const rarity = interaction.options.getString('rarity');
        const description = interaction.options.getString('description');
        const set = interaction.options.getString('set');
        const power = interaction.options.getInteger('power');

        // Send initial response
        await interaction.reply({ 
            content: '🎨 Generating card image... This may take up to 30 seconds.',
            ephemeral: true 
        });

        // Generate the card image
        let imageUrl;
        try {
            console.log('Generating card image for:', name);
            imageUrl = await generateCardImage(name);
        } catch (error) {
            console.error('Error generating image:', error);
            return await interaction.editReply({
                content: 'Failed to generate card image. Please try again later.',
                ephemeral: true
            });
        }

        // Create the card in the database
        const newCard = new Card({
            name,
            rarity,
            imageUrl,
            description,
            set,
            power
        });

        await newCard.save();

        // Update the cards.json file
        const cardsPath = path.join(__dirname, '../../config/cards.json');
        const cardsData = JSON.parse(await fs.readFile(cardsPath, 'utf8'));
        
        const cleanCard = {
            name: newCard.name,
            rarity: newCard.rarity,
            imageUrl: newCard.imageUrl,
            description: newCard.description,
            set: newCard.set,
            power: newCard.power
        };
        
        cardsData.cards.push(cleanCard);
        await fs.writeFile(cardsPath, JSON.stringify(cardsData, null, 4));

        // Create embed for the response
        const embed = {
            color: getRarityColor(rarity),
            title: '🎴 New Card Created!',
            description: `Successfully created **${name}**`,
            fields: [
                { name: 'Rarity', value: capitalizeFirst(rarity), inline: true },
                { name: 'Set', value: set, inline: true },
                { name: 'Power', value: power.toString(), inline: true },
                { name: 'Description', value: description, inline: false }
            ],
            image: { url: imageUrl },
            timestamp: new Date().toISOString()
        };

        await interaction.editReply({ 
            content: null,
            embeds: [embed],
            ephemeral: true 
        });

    } catch (error) {
        console.error('Error in /tcg createcard command:', error);
        if (!interaction.replied) {
            await interaction.reply({
                content: 'There was an error creating the card. Please try again later.',
                ephemeral: true
            });
        } else {
            await interaction.editReply({
                content: 'There was an error creating the card. Please try again later.',
                ephemeral: true
            });
        }
    }
}

function getRarityColor(rarity) {
    const colors = {
        common: 0x808080,    // Gray
        uncommon: 0x00FF00,  // Green
        rare: 0x0000FF,      // Blue
        legendary: 0xFFD700  // Gold
    };
    return colors[rarity] || 0x808080;
}

function capitalizeFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = {
    data,
    execute
}; 