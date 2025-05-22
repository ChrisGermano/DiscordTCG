const { SlashCommandBuilder } = require('@discordjs/builders');
const openCommand = require('./tcg/open');
const showcollectionCommand = require('./tcg/showcollection');
const earnCommand = require('./tcg/earn');
const tradeupCommand = require('./tcg/tradeup');
const givecurrencyCommand = require('./tcg/givecurrency');
const resetcollectionsCommand = require('./tcg/resetcollections');
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
        .addSubcommand(resetcollectionsCommand.data)
        .addSubcommand(createCardCommand.data)
        .addSubcommand(battleCommand.data)
        .addSubcommand(acceptCommand.data)
        .addSubcommand(helpCommand.data)
        .addSubcommand(viewCommand.data)
        .addSubcommand(profileCommand.data)
        .addSubcommand(fuseCommand.data)
        .addSubcommandGroup(group =>
            group
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
        const subcommand = interaction.options.getSubcommand();
        const subcommandGroup = interaction.options.getSubcommandGroup();

        // If this is a trade command (has subcommand group 'trade')
        if (subcommandGroup === 'trade') {
            await tradeCommand.execute(interaction);
            return;
        }

        // Handle all other commands
        const command = {
            'open': openCommand,
            'showcollection': showcollectionCommand,
            'earn': earnCommand,
            'tradeup': tradeupCommand,
            'givecurrency': givecurrencyCommand,
            'resetcollections': resetcollectionsCommand,
            'createcard': createCardCommand,
            'battle': battleCommand,
            'accept': acceptCommand,
            'help': helpCommand,
            'view': viewCommand,
            'profile': profileCommand,
            'fuse': fuseCommand
        }[subcommand];

        if (command) {
            await command.execute(interaction);
        }
    }
}; 