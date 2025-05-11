const { Client, Intents, Collection } = require('discord.js');
const { connectDB } = require('./config/database');
require('dotenv').config();

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES
    ]
});

// Command collection
client.commands = new Collection();

// Connect to MongoDB
connectDB();

// Load commands
const { loadCommands } = require('./commands/commandLoader');
loadCommands(client);

// Bot ready event
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
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
        await interaction.reply({
            content: 'There was an error executing this command!',
            ephemeral: true
        });
    }
});

// Login
client.login(process.env.DISCORD_TOKEN); 