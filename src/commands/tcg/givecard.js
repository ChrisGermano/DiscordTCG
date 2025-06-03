const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const { Card } = require('../../models/Card');
const UserCollection = require('../../models/UserCollection');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('givecard')
    .setDescription('Give a card to a user (Admin only)')
    .addStringOption(option =>
        option.setName('card')
            .setDescription('The name of the card to give')
            .setRequired(true))
    .addUserOption(option =>
        option.setName('user')
            .setDescription('The user to give the card to')
            .setRequired(true));

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        // Check if user is admin
        if (interaction.user.id !== config.adminUserId) {
            return await interaction.editReply('❌ Only the admin can use this command.');
        }

        const cardName = interaction.options.getString('card');
        const targetUser = interaction.options.getUser('user');

        // Find the card
        const card = await Card.findOne({ name: cardName });
        if (!card) {
            return await interaction.editReply(`❌ Card "${cardName}" not found.`);
        }

        // Find or create user's collection
        let userCollection = await UserCollection.findOne({ userId: targetUser.id });
        if (!userCollection) {
            userCollection = new UserCollection({
                userId: targetUser.id,
                username: targetUser.username,
                cards: []
            });
        }

        // Check if user already has this card
        const existingCard = userCollection.cards.find(c => 
            c.cardId && 
            c.cardId.toString() === card._id.toString() && 
            c.cardType === 'Card' &&
            !c.special
        );

        if (existingCard) {
            existingCard.quantity += 1;
        } else {
            userCollection.cards.push({
                cardId: card._id,
                cardType: 'Card',
                quantity: 1,
                special: false
            });
        }

        await userCollection.save();

        // Send confirmation to admin
        await interaction.editReply(`✅ Successfully gave 1x ${card.name} to ${targetUser}.`);

        // Try to notify the recipient
        try {
            await targetUser.send(`🎴 You received 1x ${card.name} from ${interaction.user}!`);
        } catch (dmError) {
            console.error(`Could not send DM to ${targetUser.username}:`, dmError);
            // If we can't DM them, try to mention them in the channel
            if (!interaction.ephemeral) {
                await interaction.followUp({
                    content: `${targetUser} You received 1x ${card.name}!`,
                    ephemeral: false
                });
            }
        }

    } catch (error) {
        console.error('Error in givecard command:', error);
        await interaction.editReply('❌ There was an error giving the card to the user.');
    }
}

module.exports = {
    data,
    execute
}; 