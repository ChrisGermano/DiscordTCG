const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const UserCollection = require('../../models/UserCollection');
const Card = require('../../models/Card');
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('resetcollections')
    .setDescription('Reset all user collections and cards (Admin only)');

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        if (interaction.user.id !== config.adminUserId) {
            await interaction.editReply('You are not authorized to use this command.');
            return;
        }

        const [collectionsResult, cardsResult] = await Promise.all([
            UserCollection.deleteMany({}),
            Card.deleteMany({})
        ]);

        const cardsPath = path.join(__dirname, '../../config/cards.json');
        const cardsData = JSON.parse(await fs.readFile(cardsPath, 'utf8'));
        await Card.insertMany(cardsData.cards);

        const newCardsCount = cardsData.cards.length;

        await interaction.editReply(
            `Successfully reset all collections and cards.\n` +
            `Collections removed: ${collectionsResult.deletedCount}\n` +
            `Cards removed: ${cardsResult.deletedCount}\n` +
            `Cards regenerated: ${newCardsCount}`
        );

    } catch (error) {
        console.error('Error in /tcg resetcollections command:', error);
        await interaction.editReply('There was an error resetting collections. Please try again later.');
    }
}

module.exports = {
    data,
    execute
}; 