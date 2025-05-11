const { SlashCommandBuilder } = require('@discordjs/builders');
const openCommand = require('./tcg/open');
const showcollectionCommand = require('./tcg/showcollection');
const earnCommand = require('./tcg/earn');
const tradeupCommand = require('./tcg/tradeup');
const givecurrencyCommand = require('./tcg/givecurrency');
const resetcollectionsCommand = require('./tcg/resetcollections');
const createCardCommand = require('./tcg/createCard');

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
        .addSubcommand(createCardCommand.data),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'open':
                await openCommand.execute(interaction);
                break;
            case 'showcollection':
                await showcollectionCommand.execute(interaction);
                break;
            case 'earn':
                await earnCommand.execute(interaction);
                break;
            case 'tradeup':
                await tradeupCommand.execute(interaction);
                break;
            case 'givecurrency':
                await givecurrencyCommand.execute(interaction);
                break;
            case 'resetcollections':
                await resetcollectionsCommand.execute(interaction);
                break;
            case 'createcard':
                await createCardCommand.execute(interaction);
                break;
            default:
                await interaction.reply('Unknown subcommand.');
        }
    }
}; 