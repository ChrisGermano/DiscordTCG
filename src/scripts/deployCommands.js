const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, '..', 'commands');

// Load the TCG command
const tcgCommand = require(path.join(commandsPath, 'tcg'));
commands.push(tcgCommand.data.toJSON());
console.log(`Loaded command: ${tcgCommand.data.name}`);

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        // Log the command structure for debugging
        console.log('Command structure:', JSON.stringify(commands[0], null, 2));

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
})(); 