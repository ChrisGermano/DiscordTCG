const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord-api-types/v9');
const UserCredits = require('../../models/UserCredits');
const config = require('../../config');

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
        try {
            // Check if user has admin permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: '❌ You do not have permission to use this command.',
                    ephemeral: true
                });
            }

            // Get all options
            const options = interaction.options._hoistedOptions;
            console.log('All command options:', options);

            // Get the user option specifically
            const userOption = options.find(opt => opt.name === 'user');
            console.log('User option:', userOption);

            if (!userOption || !userOption.user) {
                console.error('No user option found or user is null:', userOption);
                return interaction.reply({
                    content: '❌ Please provide a valid user to give currency to.',
                    ephemeral: true
                });
            }

            const targetUser = userOption.user;
            const amount = interaction.options.getInteger('amount');

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

            // Send confirmation to the admin
            await interaction.reply({
                content: `✅ Successfully gave ${amount} ${config.currencyName} to ${targetUser}. Their new balance is ${userCredits.credits} ${config.currencyName}.`,
                ephemeral: true
            });

            // Send notification to the recipient
            try {
                await targetUser.send({
                    content: `💰 You received ${amount} ${config.currencyName} from ${interaction.user}! Your new balance is ${userCredits.credits} ${config.currencyName}.`
                });
            } catch (dmError) {
                console.error(`Could not send DM to ${targetUser.username}:`, dmError);
                // If we can't DM them, try to mention them in the channel
                if (!interaction.ephemeral) {
                    await interaction.followUp({
                        content: `${targetUser} You received ${amount} ${config.currencyName}! Your new balance is ${userCredits.credits} ${config.currencyName}.`,
                        ephemeral: false
                    });
                }
            }

        } catch (error) {
            console.error('Error in givecurrency command:', error);
            await interaction.reply({
                content: '❌ There was an error giving currency to the user.',
                ephemeral: true
            });
        }
    }
}; 