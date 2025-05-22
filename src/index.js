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

// Recursive function to load commands from directories
function loadCommands(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            // Recursively load commands from subdirectories
            loadCommands(filePath);
        } else if (file.endsWith('.js') && file !== 'commandLoader.js') {
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`Loaded command: ${command.data.name}`);
            }
        }
    }
}

// Load all commands
loadCommands(path.join(__dirname, 'commands'));

// Bot ready event
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Loaded ${client.commands.size} commands`);
});

// Interaction handling
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
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