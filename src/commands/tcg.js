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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tcg')
        .setDescription('TCG card commands')
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
                            .setRequired(true)))),

    async execute(interaction) {
        console.log('TCG command received');
        console.log('Raw options:', interaction.options);
        console.log('Options data:', interaction.options.data);
        console.log('Hoisted options:', interaction.options._hoistedOptions);
        
        let subcommand;
        let subcommandGroup;
        
        try {
            // First try to get the subcommand
            subcommand = interaction.options.getSubcommand();
            console.log('Subcommand name:', subcommand);
            
            // Only try to get subcommand group if it exists
            try {
                subcommandGroup = interaction.options.getSubcommandGroup();
                console.log('Subcommand group:', subcommandGroup);
            } catch (error) {
                // If no subcommand group exists, that's fine - just set it to null
                subcommandGroup = null;
                console.log('No subcommand group found');
            }
            
            console.log(`Subcommand: ${subcommand}, Group: ${subcommandGroup}`);
        } catch (error) {
            console.error('Error getting subcommand:', error);
            return await interaction.reply({
                content: 'Please use a valid subcommand. Use `/tcg help` to see available commands.',
                ephemeral: true
            });
        }

        // If this is a trade command (has subcommand group 'trade')
        if (subcommandGroup === 'trade') {
            console.log('Executing trade command');
            return await tradeCommand.execute(interaction);
        }

        // Handle all other commands
        const command = {
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
            'fuse': fuseCommand
        }[subcommand];

        if (command) {
            console.log(`Executing subcommand: ${subcommand}`);
            console.log('Command options before execution:', interaction.options);
            return await command.execute(interaction);
        } else {
            console.log(`Unknown subcommand: ${subcommand}`);
            return await interaction.reply({
                content: `Unknown subcommand: ${subcommand}. Use \`/tcg help\` to see available commands.`,
                ephemeral: true
            });
        }
    }
}; 