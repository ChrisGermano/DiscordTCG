const fs = require('fs');
const path = require('path');

function loadCommands(client) {
    const commandsPath = path.join(__dirname);
    const commandFiles = fs.readdirSync(commandsPath)
        .filter(file => {
            const filePath = path.join(commandsPath, file);
            return file.endsWith('.js') && 
                   file !== 'commandLoader.js' && 
                   file !== 'tcg.js' &&
                   fs.statSync(filePath).isFile();
        });

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }

    const tcgCommand = require('./tcg');
    if ('data' in tcgCommand && 'execute' in tcgCommand) {
        client.commands.set(tcgCommand.data.name, tcgCommand);
    } else {
        console.log(`[WARNING] The TCG command is missing a required "data" or "execute" property.`);
    }
}

module.exports = { loadCommands }; 