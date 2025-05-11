const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const Card = require('../../models/Card');
const fs = require('fs').promises;
const path = require('path');

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
        option.setName('imageurl')
            .setDescription('The URL of the card image')
            .setRequired(true))
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
            .setDescription('The power of the card')
            .setRequired(true));

async function execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    try {
        const name = interaction.options.getString('name');
        const rarity = interaction.options.getString('rarity');
        const imageUrl = interaction.options.getString('imageurl');
        const description = interaction.options.getString('description');
        const set = interaction.options.getString('set');
        const power = interaction.options.getInteger('power');

        const newCard = new Card({
            name,
            rarity,
            imageUrl,
            description,
            set,
            power
        });

        await newCard.save();

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

        await interaction.reply({
            content: `Successfully created new card: **${name}**\nRarity: ${rarity}\nSet: ${set}\nPower: ${power}`,
            ephemeral: true
        });
    } catch (error) {
        console.error('Error in /tcg createcard command:', error);
        await interaction.reply({
            content: 'There was an error creating the card. Please try again later.',
            ephemeral: true
        });
    }
}

module.exports = {
    data,
    execute
}; 