const { Client, Collection, Intents } = require('discord.js');
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

// Load commands
require('./commands/commandLoader')(client);

// Bot ready event
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Interaction handling
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    console.log(`Received command: ${interaction.commandName}`);
    console.log('Command options:', interaction.options._hoistedOptions);
    console.log('Interaction state:', {
        replied: interaction.replied,
        deferred: interaction.deferred,
        ephemeral: interaction.ephemeral
    });

    const command = client.commands.get(interaction.commandName);
    if (!command) {
        console.log(`Command not found: ${interaction.commandName}`);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: 'Command not found. Please try again later.',
                ephemeral: true 
            });
        }
        return;
    }

    try {
        console.log(`Executing command: ${interaction.commandName}`);
        await command.execute(interaction);
        console.log(`Successfully executed command: ${interaction.commandName}`);
    } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        
        // Only try to send an error message if we haven't responded yet
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({ 
                    content: 'There was an error executing this command.',
                    ephemeral: true 
                });
            } catch (replyError) {
                console.error('Failed to send error message:', replyError);
            }
        } else if (interaction.deferred) {
            try {
                await interaction.editReply({ 
                    content: 'There was an error executing this command.',
                    ephemeral: true 
                });
            } catch (editError) {
                console.error('Failed to edit error message:', editError);
            }
        }
    }
});

// Login
client.login(process.env.DISCORD_TOKEN); 