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
    // Handle autocomplete interactions
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            // Get the subcommand if it exists
            const subcommand = interaction.options.getSubcommand(false);
            let subcommandGroup = null;

            try {
                subcommandGroup = interaction.options.getSubcommandGroup(false);
            } catch (error) {
                // No subcommand group, which is fine
            }

            // Handle trade command group
            if (subcommandGroup === 'trade') {
                const tradeCommand = require('./commands/tcg/trade');
                if (tradeCommand.autocomplete) {
                    await tradeCommand.autocomplete(interaction);
                }
                return;
            }

            // Handle regular subcommands
            const commandMap = {
                'open': require('./commands/tcg/open'),
                'showcollection': require('./commands/tcg/showcollection'),
                'earn': require('./commands/tcg/earn'),
                'tradeup': require('./commands/tcg/tradeup'),
                'givecurrency': require('./commands/tcg/givecurrency'),
                'givecard': require('./commands/tcg/givecard'),
                'help': require('./commands/tcg/help'),
                'view': require('./commands/tcg/view'),
                'profile': require('./commands/tcg/profile'),
                'fuse': require('./commands/tcg/fuse'),
                'inspect': require('./commands/tcg/inspect'),
                'battle': require('./commands/tcg/battle')
            };

            const subcommandHandler = commandMap[subcommand];
            if (subcommandHandler && typeof subcommandHandler.autocomplete === 'function') {
                await subcommandHandler.autocomplete(interaction);
            }
        } catch (error) {
            console.error('Error handling autocomplete:', error);
            await interaction.respond([]);
        }
        return;
    }

    // Handle regular commands
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