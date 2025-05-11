const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const UserCredits = require('../../models/UserCredits');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('givecurrency')
    .setDescription(`Give ${config.currencyName} to a user (Admin only)`)
    .addStringOption(option =>
        option.setName('username')
            .setDescription(`The username of the user to give ${config.currencyName} to`)
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName('amount')
            .setDescription(`The amount of ${config.currencyName} to give`)
            .setRequired(true)
            .setMinValue(1));

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        if (interaction.user.id !== config.adminUserId) {
            await interaction.editReply('You are not authorized to use this command.');
            return;
        }

        const username = interaction.options.getString('username');
        const amount = interaction.options.getInteger('amount');

        const userCredits = await UserCredits.findOne({ userId: username });

        if (!userCredits) {
            await interaction.editReply(`User ${username} not found.`);
            return;
        }

        userCredits.credits += amount;
        await userCredits.save();

        await interaction.editReply(`Successfully gave ${amount} ${config.currencyName} to ${username}. They now have ${userCredits.credits} ${config.currencyName}.`);

    } catch (error) {
        console.error(`Error in /tcg givecurrency command:`, error);
        await interaction.editReply(`There was an error giving ${config.currencyName}. Please try again later.`);
    }
}

module.exports = {
    data,
    execute
}; 