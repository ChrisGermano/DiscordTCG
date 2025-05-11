# Discord TCG Bot

A Discord bot framework for building and managing a Trading Card Game (TCG) system.

## Core Features

### Card System
- Card rarities: Common, Uncommon, Rare, Legendary
- Special variant cards with unique prefixes
- Card attributes: name, rarity, image, description, set, power
- Card collection management with quantity tracking

### Economy
- Virtual currency system
- Pack opening system with configurable costs
- Daily currency earning through `/tcg earn` (12-hour cooldown)

### Commands
- `/tcg open` - Open a card pack
- `/tcg showcollection` - View your card collection
- `/tcg tradeup` - Trade 5 cards for one higher rarity card
- `/tcg earn` - Earn currency (cooldown-based)
- `/tcg createcard` - Admin command to create new cards
- `/tcg givecurrency` - Admin command to manage currency
- `/tcg resetcollections` - Admin command to reset game state

### Technical Stack
- Node.js with Discord.js v13
- MongoDB for data persistence
- Mongoose for data modeling
- Slash command architecture

## Setup
1. Install dependencies: `npm install`
2. Configure environment variables
3. Deploy commands: `npm run deploy`
4. Start bot: `npm start`

## Environment Variables
Create a `.env` file in the root directory with the following variables:

### Required Variables
- `DISCORD_TOKEN` - Your Discord bot token
- `MONGODB_URI` - MongoDB connection string
- `ADMIN_USER_ID` - Discord user ID of the bot's admin

### Optional Variables
- `CURRENCY_NAME` - Name of the virtual currency
- `DEFAULT_CREDITS` - Starting currency amount for new users
- `PACK_COST` - Cost to open a card pack
- `DRINK_WATER_COOLDOWN` - Cooldown for earning currency in milliseconds (default: 43200000, 12 hours)
- `SPECIAL_CHANCE` - Chance to generate a special variant card (default: 0.1, 10%)
- `LEGENDARY_CHANCE` - Chance to get a legendary card in a pack (default: 0.01, 1%)
- `SPECIAL_PREFIX` - Prefix for special variant cards

Example `.env` file:
```env
DISCORD_TOKEN=your_discord_token_here
MONGODB_URI=
ADMIN_USER_ID=
CURRENCY_NAME=Moneybucks
DEFAULT_CREDITS=10
PACK_COST=5
DRINK_WATER_COOLDOWN=43200000
SPECIAL_CHANCE=0.1
LEGENDARY_CHANCE=0.01
SPECIAL_PREFIX=Shiny
```
