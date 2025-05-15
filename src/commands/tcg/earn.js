const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const UserCredits = require('../../models/UserCredits');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('earn')
    .setDescription(`Earn 1 ${config.currencyName.slice(0, -1)} (12 hour cooldown)`);

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        let userCredits = await UserCredits.findOne({ userId: interaction.user.id });
        
        if (!userCredits) {
            userCredits = new UserCredits({ userId: interaction.user.id });
        }

        const now = new Date();
        const cooldownTime = config.earnCooldown;

        if (userCredits.lastEarnTime && (now - userCredits.lastEarnTime) < cooldownTime) {
            const timeLeft = cooldownTime - (now - userCredits.lastEarnTime);
            const hoursLeft = Math.ceil(timeLeft / (60 * 60 * 1000));
            await interaction.editReply(`You need to wait ${hoursLeft} more hour(s) before earning again.`);
            return;
        }

        userCredits.credits += 1;
        userCredits.lastEarnTime = now;
        await userCredits.save();

        await interaction.editReply(`You earned 1 ${config.currencyName.slice(0, -1)}! You now have ${userCredits.credits} ${config.currencyName}.`);

    } catch (error) {
        console.error('Error in /tcg earn command:', error);
        await interaction.editReply('There was an error processing your earnings. Please try again later.');
    }
}

module.exports = {
    data,
    execute
}; 