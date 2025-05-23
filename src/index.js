const { Client, Collection, Intents } = require('discord.js');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGES
    ]
});

// Command collection
client.commands = new Collection();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Load the TCG command
const tcgCommand = require('./commands/tcg');
client.commands.set(tcgCommand.data.name, tcgCommand);
console.log(`Loaded command: ${tcgCommand.data.name}`);

// Bot ready event
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Loaded ${client.commands.size} commands`);
});

// Interaction handling
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    console.log(`Received command: ${interaction.commandName}`);
    console.log('Command options:', interaction.options._hoistedOptions);

    const command = client.commands.get(interaction.commandName);
    if (!command) {
        console.log(`Command not found: ${interaction.commandName}`);
        return;
    }

    try {
        console.log(`Executing command: ${interaction.commandName}`);
        await command.execute(interaction);
        console.log(`Successfully executed command: ${interaction.commandName}`);
    } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        const errorMessage = { content: 'There was an error executing this command.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

// Login
client.login(process.env.DISCORD_TOKEN); 