const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const Battle = require('../../models/Battle');
const UserCollection = require('../../models/UserCollection');
const Card = require('../../models/Card');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('battle')
    .setDescription('Challenge another user to a card battle')
    .addUserOption(option =>
        option.setName('opponent')
            .setDescription('The user to challenge')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('card')
            .setDescription('The card to use in battle')
            .setRequired(true));

async function execute(interaction) {
    await interaction.deferReply();

    try {
        const opponent = interaction.options.getUser('opponent');
        const cardName = interaction.options.getString('card');

        // Prevent self-battles
        if (opponent.id === interaction.user.id) {
            await interaction.editReply('You cannot challenge yourself to a battle!');
            return;
        }

        // Check if either user is in an active battle
        const activeBattle = await Battle.findOne({
            $or: [
                { challengerId: interaction.user.id, status: { $in: ['pending', 'in_progress'] } },
                { defenderId: interaction.user.id, status: { $in: ['pending', 'in_progress'] } },
                { challengerId: opponent.id, status: { $in: ['pending', 'in_progress'] } },
                { defenderId: opponent.id, status: { $in: ['pending', 'in_progress'] } }
            ]
        });

        if (activeBattle) {
            await interaction.editReply('One or both players are already in an active battle!');
            return;
        }

        // Get challenger's card
        const challengerCollection = await UserCollection.findOne({ userId: interaction.user.id })
            .populate('cards.cardId');
        
        if (!challengerCollection) {
            await interaction.editReply('You don\'t have any cards to battle with!');
            return;
        }

        const challengerCard = challengerCollection.cards.find(c => 
            c.cardId.name.toLowerCase() === cardName.toLowerCase() && 
            c.quantity > 0
        );

        if (!challengerCard) {
            await interaction.editReply(`You don't have "${cardName}" in your collection!`);
            return;
        }

        // Get defender's collection to verify they have cards
        const defenderCollection = await UserCollection.findOne({ userId: opponent.id })
            .populate('cards.cardId');

        if (!defenderCollection || defenderCollection.cards.length === 0) {
            await interaction.editReply(`${opponent.username} doesn't have any cards to battle with!`);
            return;
        }

        // Create the battle
        const battle = new Battle({
            challengerId: interaction.user.id,
            defenderId: opponent.id,
            challengerCardId: challengerCard.cardId._id,
            status: 'pending'
        });

        await battle.save();

        // Send challenge message
        const challengeEmbed = {
            color: 0x0099ff,
            title: 'Card Battle Challenge!',
            description: `${interaction.user.username} has challenged ${opponent.username} to a card battle!`,
            fields: [
                {
                    name: 'Challenger\'s Card',
                    value: `${challengerCard.cardId.name}\nPower: ${challengerCard.cardId.power}\nRarity: ${challengerCard.cardId.rarity}`
                },
                {
                    name: 'How to Accept',
                    value: `${opponent.username}, use \`/tcg accept\` to accept the challenge and select your card!`
                }
            ],
            timestamp: new Date()
        };

        await interaction.editReply({ embeds: [challengeEmbed] });

    } catch (error) {
        console.error('Error in /tcg battle command:', error);
        await interaction.editReply('There was an error processing your battle challenge. Please try again later.');
    }
}

module.exports = {
    data,
    execute
}; 