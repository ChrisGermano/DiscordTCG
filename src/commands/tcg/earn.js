const { SlashCommandSubcommandBuilder } = require('@discordjs/builders');
const UserCredits = require('../../models/UserCredits');
const UserCollection = require('../../models/UserCollection');
const Card = require('../../models/Card');
const User = require('../../models/User');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('earn')
    .setDescription(`Earn credits based on your level (${config.earnCooldown / (60 * 60 * 1000)} hour cooldown)`);

async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        // Get user's credits, collection, and level
        const [userCredits, userCollection, user] = await Promise.all([
            UserCredits.findOne({ userId: interaction.user.id }),
            UserCollection.findOne({ userId: interaction.user.id })
                .populate({
                    path: 'cards.cardId',
                    refPath: 'cards.cardType'
                }),
            User.findOne({ userId: interaction.user.id })
        ]);
        
        if (!userCredits) {
            userCredits = new UserCredits({ userId: interaction.user.id });
        }

        // Register new user if they don't exist
        if (!user) {
            user = new User({
                userId: interaction.user.id,
                username: interaction.user.username
            });
            await user.save();
        }

        const now = new Date();
        const cooldownTime = config.earnCooldown;

        if (userCredits.lastEarnTime && (now - userCredits.lastEarnTime) < cooldownTime) {
            const timeLeft = cooldownTime - (now - userCredits.lastEarnTime);
            const hoursLeft = Math.ceil(timeLeft / (60 * 60 * 1000));
            const minutesLeft = Math.ceil((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            
            let timeMessage = '';
            if (hoursLeft > 0) {
                timeMessage += `${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}`;
            }
            if (minutesLeft > 0) {
                if (hoursLeft > 0) timeMessage += ' and ';
                timeMessage += `${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}`;
            }
            
            await interaction.editReply(`You need to wait ${timeMessage} before earning again.`);
            return;
        }

        // Check for Gorvyn bonus
        let hasGorvyn = false;
        if (userCollection) {
            const gorvynCard = await Card.findOne({ name: 'Gorvyn the Gilded Boar' });
            if (gorvynCard) {
                hasGorvyn = userCollection.cards.some(card => 
                    card.cardId && 
                    card.cardId._id.toString() === gorvynCard._id.toString() && 
                    card.quantity > 0
                );
            }
        }

        // Calculate base credits (equal to user's level) and apply Gorvyn's multiplier
        let creditsToGive = user.level;
        if (hasGorvyn) {
            creditsToGive *= 2;
        }

        userCredits.credits += creditsToGive;
        userCredits.lastEarnTime = now;
        await userCredits.save();

        let message = `You earned ${creditsToGive} ${config.currencyName.slice(0, -1)}!`;
        if (hasGorvyn) {
            message += ` (Doubled by Gorvyn the Gilded Boar)`;
        }
        message += ` You now have ${userCredits.credits} ${config.currencyName}.`;

        await interaction.editReply(message);

    } catch (error) {
        console.error('Error in /tcg earn command:', error);
        await interaction.editReply('There was an error processing your earnings. Please try again later.');
    }
}

module.exports = {
    data,
    execute
}; 