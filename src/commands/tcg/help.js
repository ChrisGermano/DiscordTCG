const { SlashCommandSubcommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('help')
    .setDescription('List all available TCG commands and their functions');

const COMMANDS = {
    battle: {
        description: 'Challenge another user to a card battle',
        usage: '/tcg battle @opponent card_name',
        example: '/tcg battle @user Dragon'
    },
    accept: {
        description: 'Accept a battle challenge and select your card',
        usage: '/tcg accept card_name',
        example: '/tcg accept Phoenix'
    },
    earn: {
        description: `Earn 1 ${config.currencyName.slice(0, -1)} (${config.earnCooldown / (60 * 60 * 1000)} hour cooldown)`,
        usage: '/tcg earn',
        example: '/tcg earn'
    },
    open: {
        description: `Open a new pack of cards (Costs ${config.packCost} ${config.currencyName})`,
        usage: '/tcg open',
        example: '/tcg open'
    },
    view: {
        description: 'View your card collection with optional rarity and set filters',
        usage: '/tcg view [rarity] [set]',
        example: '/tcg view rare "Dragon Set"'
    },
    profile: {
        description: 'View your collection statistics and card breakdown',
        usage: '/tcg profile',
        example: '/tcg profile'
    }
};

async function execute(interaction) {
    try {
        const fields = Object.entries(COMMANDS).map(([command, info]) => ({
            name: command,
            value: [
                `**Description:** ${info.description}`,
                `**Usage:** \`${info.usage}\``,
                `**Example:** \`${info.example}\``
            ].join('\n'),
            inline: false
        }));

        const embed = {
            color: 0x0099FF,
            title: 'TCG Bot Commands',
            description: 'Here are all available commands for the TCG system. Use `/tcg help` to see this message again.',
            fields: fields,
            footer: {
                text: 'Tip: All commands are used with /tcg prefix'
            },
            timestamp: new Date().toISOString()
        };

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('Error in /tcg help command:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'There was an error displaying the help message. Please try again later.', ephemeral: true });
        }
    }
}

module.exports = {
    data,
    execute
}; 