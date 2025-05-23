const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord-api-types/v9');
const UserCredits = require('../../models/UserCredits');

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('givecurrency')
        .setDescription('Give currency to a user (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to give currency to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of currency to give')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        // Check if user has admin permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true
            });
        }

        console.log('Command options:', interaction.options._hoistedOptions);

        const targetUser = interaction.options.getUser('user');
        if (!targetUser) {
            console.error('No user provided in options');
            return interaction.reply({
                content: '❌ Please provide a valid user to give currency to.',
                ephemeral: true
            });
        }

        const amount = interaction.options.getInteger('amount');
        if (!amount) {
            console.error('No amount provided in options');
            return interaction.reply({
                content: '❌ Please provide a valid amount of currency to give.',
                ephemeral: true
            });
        }

        try {
            console.log('Target user:', {
                id: targetUser.id,
                username: targetUser.username,
                tag: targetUser.tag
            });

            // Find or create user credits
            let userCredits = await UserCredits.findOne({ userId: targetUser.id });
            console.log('Found user credits:', userCredits);
            
            if (!userCredits) {
                console.log('Creating new user credits record');
                userCredits = new UserCredits({
                    userId: targetUser.id,
                    username: targetUser.username,
                    credits: 0
                });
            }

            // Add the currency
            userCredits.credits += amount;
            await userCredits.save();
            console.log('Updated user credits:', userCredits);

            await interaction.reply({
                content: `✅ Successfully gave ${amount} currency to ${targetUser.username}. Their new balance is ${userCredits.credits} currency.`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error in givecurrency command:', error);
            await interaction.reply({
                content: '❌ There was an error giving currency to the user.',
                ephemeral: true
            });
        }
    }
}; 