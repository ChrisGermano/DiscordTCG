const { SlashCommandSubcommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const config = require('../../config/config');

const data = new SlashCommandSubcommandBuilder()
    .setName('help')
    .setDescription('List all available TCG commands and their functions');

const COMMANDS = {
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
    showcollection: {
        description: 'Display your complete card collection',
        usage: '/tcg showcollection',
        example: '/tcg showcollection'
    },
    inspect: {
        description: 'View detailed information about a specific card in your collection',
        usage: '/tcg inspect card_name',
        example: '/tcg inspect "Dragon"'
    },
    profile: {
        description: 'View your or another user\'s collection statistics and card breakdown',
        usage: '/tcg profile [@user]',
        example: '/tcg profile @username'
    },
    trade: {
        description: 'Trade cards with other users',
        usage: '/tcg trade <subcommand>',
        example: '/tcg trade offer "Card1, Card2" "Card3" @user',
        subcommands: {
            'offer': {
                description: 'Offer a trade to another user',
                usage: '/tcg trade offer <cards> <for> <user>',
                example: '/tcg trade offer "Card1, Card2" "Card3" @user'
            },
            'accept': {
                description: 'Accept a trade offer',
                usage: '/tcg trade accept <trade_id>',
                example: '/tcg trade accept "123e4567-e89b-12d3-a456-426614174000"'
            },
            'cancel': {
                description: 'Cancel a trade offer',
                usage: '/tcg trade cancel <trade_id>',
                example: '/tcg trade cancel "123e4567-e89b-12d3-a456-426614174000"'
            }
        }
    },
    tradeup: {
        description: 'Trade up multiple cards of the same rarity for a higher rarity card',
        usage: '/tcg tradeup',
        example: '/tcg tradeup'
    },
    fuse: {
        description: 'Fuse two cards to create a special fused card',
        usage: '/tcg fuse <card1> <card2>',
        example: '/tcg fuse "Dragon" "Phoenix"'
    },
    earn: {
        description: `Earn 1 ${config.currencyName.slice(0, -1)} (${config.earnCooldown / (60 * 60 * 1000)} hour cooldown)`,
        usage: '/tcg earn',
        example: '/tcg earn'
    },
    givecurrency: {
        description: '[Admin] Give currency to a user',
        usage: '/tcg givecurrency <user> <amount>',
        example: '/tcg givecurrency @username 100'
    },
    givecard: {
        description: '[Admin] Give a card to a user',
        usage: '/tcg givecard <card_name> <user>',
        example: '/tcg givecard "Dragon" @username'
    },
    help: {
        description: 'List all available commands and their functions',
        usage: '/tcg help',
        example: '/tcg help'
    },
    battle: {
        description: 'Start a battle against a bot enemy using one of your cards',
        usage: '/tcg battle <card_name> <difficulty>',
        example: '/tcg battle "Dragon" medium'
    }
};

async function execute(interaction) {
    try {
        const fields = Object.entries(COMMANDS).map(([command, info]) => {
            let value = [
                `**Description:** ${info.description}`,
                `**Usage:** \`${info.usage}\``,
                `**Example:** \`${info.example}\``
            ];

            if (info.subcommands) {
                value.push('\n**Subcommands:**');
                Object.entries(info.subcommands).forEach(([subcmd, subinfo]) => {
                    value.push(
                        `\n**${subcmd}**`,
                        `Description: ${subinfo.description}`,
                        `Usage: \`${subinfo.usage}\``,
                        `Example: \`${subinfo.example}\``
                    );
                });
            }

            return {
                name: command,
                value: value.join('\n'),
                inline: false
            };
        });

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