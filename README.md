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
- `CURRENCY_NAME` - Name of the virtual currency (default: "Vladbucks")
- `DEFAULT_CREDITS` - Starting currency amount for new users (default: 10)
- `PACK_COST` - Cost to open a card pack (default: 5)
- `EARN_COOLDOWN` - Cooldown for earning currency in milliseconds (default: 43200000, 12 hours)
- `SPECIAL_CHANCE` - Chance to generate a special variant card (default: 0.1, 10%)
- `LEGENDARY_CHANCE` - Chance to get a legendary card in a pack (default: 0.01, 1%)
- `SPECIAL_PREFIX` - Prefix for special variant cards (default: null, disabled)

Example `.env` file:
```env
DISCORD_TOKEN=your_discord_token_here
MONGODB_URI=
ADMIN_USER_ID=
CURRENCY_NAME=Moneybucks
DEFAULT_CREDITS=10
PACK_COST=5
EARN_COOLDOWN=43200000
SPECIAL_CHANCE=0.1
LEGENDARY_CHANCE=0.01
SPECIAL_PREFIX=Shiny
```

## Discord Bot Setup

### 1. Create a Discord Application
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Navigate to the "Bot" tab and click "Add Bot"
4. Under the bot's username, click "Reset Token" to get your bot token (save this for your `.env` file)

### 2. Configure Bot Permissions
1. Go to the "OAuth2" tab in your application
2. Select "URL Generator" from the sidebar
3. Under "Scopes", select:
   - `bot`
   - `applications.commands`
4. Under "Bot Permissions", select:
   - `Send Messages`
   - `Use Slash Commands`
5. Copy the generated URL at the bottom of the page

### 3. Invite the Bot
1. Open the generated URL in a new browser tab
2. Select your server from the dropdown
3. Click "Authorize"
4. Complete the CAPTCHA if prompted

### 4. Get Required IDs
1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click your server and select "Copy Server ID" (for `GUILD_ID` if using guild-specific commands)
3. Right-click your user profile and select "Copy User ID" (for `ADMIN_USER_ID`)

### 5. Final Setup
1. Create a `.env` file in the project root
2. Add your bot token and other environment variables
3. Run `npm run deploy` to register slash commands
4. Start the bot with `npm start`

Note: The bot requires the following Discord permissions to function:
- `Send Messages`: To send card information and responses
- `Use Slash Commands`: To register and use the TCG commands
