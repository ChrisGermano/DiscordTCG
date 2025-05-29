const { SlashCommandBuilder } = require('@discordjs/builders');
const openCommand = require('./tcg/open');
const showcollectionCommand = require('./tcg/showcollection');
const earnCommand = require('./tcg/earn');
const tradeupCommand = require('./tcg/tradeup');
const givecurrencyCommand = require('./tcg/givecurrency');
const resetCommand = require('./tcg/reset');
const createCardCommand = require('./tcg/createCard');
const battleCommand = require('./tcg/battle');
const acceptCommand = require('./tcg/accept');
const helpCommand = require('./tcg/help');
const viewCommand = require('./tcg/view');
const profileCommand = require('./tcg/profile');
const fuseCommand = require('./tcg/fuse');
const tradeCommand = require('./tcg/trade');
const inspectCommand = require('./tcg/inspect');

const data = new SlashCommandBuilder()
    .setName('tcg')
    .setDescription('TCG system commands')
    .addSubcommand(openCommand.data)
    .addSubcommand(showcollectionCommand.data)
    .addSubcommand(earnCommand.data)
    .addSubcommand(tradeupCommand.data)
    .addSubcommand(givecurrencyCommand.data)
    .addSubcommand(resetCommand.data)
    .addSubcommand(createCardCommand.data)
    .addSubcommand(battleCommand.data)
    .addSubcommand(acceptCommand.data)
    .addSubcommand(helpCommand.data)
    .addSubcommand(viewCommand.data)
    .addSubcommand(profileCommand.data)
    .addSubcommand(fuseCommand.data)
    .addSubcommand(inspectCommand.data)
    .addSubcommandGroup(group => group
        .setName('trade')
        .setDescription('Trade cards with other users')
        .addSubcommand(subcommand =>
            subcommand
                .setName('offer')
                .setDescription('Offer a trade to another user')
                .addStringOption(option =>
                    option.setName('cards')
                        .setDescription('Cards you want to trade (comma-separated)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('for')
                        .setDescription('Cards you want in return (comma-separated)')
                        .setRequired(true))
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to trade with')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('accept')
                .setDescription('Accept a trade offer')
                .addStringOption(option =>
                    option.setName('trade_id')
                        .setDescription('ID of the trade to accept')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Cancel a trade offer')
                .addStringOption(option =>
                    option.setName('trade_id')
                        .setDescription('ID of the trade to cancel')
                        .setRequired(true))));

async function execute(interaction) {
    try {
        const subcommand = interaction.options.getSubcommand(false);
        let subcommandGroup = null;

        try {
            subcommandGroup = interaction.options.getSubcommandGroup(false);
        } catch (error) {
            // No subcommand group, which is fine for regular commands
        }

        // Handle trade command group
        if (subcommandGroup === 'trade') {
            return await tradeCommand.execute(interaction);
        }

        // Handle regular subcommands
        const commandMap = {
            'open': openCommand,
            'showcollection': showcollectionCommand,
            'earn': earnCommand,
            'tradeup': tradeupCommand,
            'givecurrency': givecurrencyCommand,
            'reset': resetCommand,
            'createcard': createCardCommand,
            'battle': battleCommand,
            'accept': acceptCommand,
            'help': helpCommand,
            'view': viewCommand,
            'profile': profileCommand,
            'fuse': fuseCommand,
            'inspect': inspectCommand
        };

        const command = commandMap[subcommand];
        if (!command || typeof command.execute !== 'function') {
            throw new Error(`Unknown subcommand: ${subcommand}`);
        }

        await command.execute(interaction);

    } catch (error) {
        console.error('Error in TCG command:', error);
        const errorMessage = 'There was an error executing the command. Please try again later.';
        
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.editReply({ content: errorMessage, ephemeral: true });
        }
    }
}

module.exports = {
    data,
    execute
}; 