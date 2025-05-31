# Discord TCG Bot

A Discord bot framework for building and managing a Trading Card Game (TCG) system.

## Core Features

### Card System
- Card rarities: Common, Uncommon, Rare, Legendary
- Special variant cards with unique prefixes
- Card attributes: name, rarity, image, description, set, power
- Card collection management with quantity tracking
- Visual card display with combined pack opening images
- Automatic image generation for cards without images

### Trading System
- Direct card trading between users
- Trade validation and safety checks
- Rate limiting to prevent spam
- Transaction safety for trade execution
- Support for multi-card trades
- Trade status tracking (pending/completed/cancelled)
- Automatic trade notifications
- Protection against invalid trades and special cards

### Economy
- Virtual currency system
- Pack opening system with configurable costs
- Daily currency earning through `/tcg earn` (configurable cooldown)
- Configurable starting currency amount
- Configurable pack costs and legendary card chances

### Battle System
- Card battles between users
- Power-based combat system
- Battle history tracking
- Automatic battle resolution
- Battle rewards and XP gain

### Commands
- `/tcg open` - Open a card pack (now includes visual card display)
- `/tcg view` - View your card collection with optional rarity and set filters
- `/tcg profile` - View your collection statistics and card breakdown
- `/tcg inspect` - View detailed information about a specific card
- `/tcg battle` - Challenge another user to a card battle
- `/tcg accept` - Accept a battle challenge
- `/tcg earn` - Earn currency (cooldown-based)
- `/tcg createcard` - Admin command to create new cards
- `/tcg reset` - Admin command to reset the entire TCG system
- `/tcg trade` - Trade cards with other users
  - `/tcg trade offer <cards> <for> <user>` - Offer a trade to another user
  - `/tcg trade accept <trade_id>` - Accept a trade offer
  - `/tcg trade cancel <trade_id>` - Cancel a trade offer

### Visual Features
- Combined card images for pack openings
- Consistent card sizing and spacing
- Discord dark theme integration
- Placeholder images for cards without images
- Automatic image processing and optimization

### Trading System Details

#### Trade Limits
- Maximum 10 cards per trade
- Rate limit: 3 trades per minute
- Special cards cannot be traded
- Cards must be in the same server
- Users must be able to receive DMs

#### Trade Safety Features
- Transaction-based trade execution
- Validation of card ownership and quantities
- Prevention of double-trading cards
- Automatic trade cancellation if cards become unavailable
- Server membership verification
- DM permission checking

#### Trade Flow
1. User initiates trade with `/tcg trade offer`
   - Specifies cards to trade and receive
   - Selects target user
   - System validates card ownership and quantities
2. Target user receives trade offer via DM
3. Target user can:
   - Accept trade with `/tcg trade accept`
   - Cancel trade with `/tcg trade cancel`
4. System executes trade atomically
   - Updates both users' collections
   - Sends confirmation to both users
   - Records trade completion

#### Trade Notifications
- Trade offers are sent via DM
- Both users receive notifications for:
  - Trade offers
  - Trade completions
  - Trade cancellations
- Clear error messages for invalid trades

#### Trade Examples
```
# Offer a trade
/tcg trade offer cards:"Card1, Card2" for:"Card3" user:@username

# Accept a trade
/tcg trade accept trade_id:"123e4567-e89b-12d3-a456-426614174000"

# Cancel a trade
/tcg trade cancel trade_id:"123e4567-e89b-12d3-a456-426614174000"
```

#### Common Issues and Solutions
1. **Invalid String Length Error**
   - Card names must be between 1 and 100 characters
   - Use exact card names as shown in your collection
   - Avoid special characters in card names
   - Example of correct format: `"Card Name"` or `"Card1, Card2"`

2. **Trade Not Found**
   - Verify the trade ID is correct
   - Trade IDs are case-sensitive
   - Check if the trade was already completed or cancelled
   - Ensure you're using the trade ID from the most recent trade offer

3. **Cannot Send Trade Offer**
   - Target user must be in the same server
   - Target user must have DMs enabled
   - Target user must not have blocked the bot
   - Try using the user's mention (@username) format

4. **Trade Cancelled Automatically**
   - Cards must be available in both users' collections
   - Cards cannot be part of another pending trade
   - Special cards cannot be traded
   - Check your collection with `/tcg showcollection` before trading

5. **Rate Limit Reached**
   - Wait 60 seconds between trade attempts
   - Maximum 3 trades per minute
   - The cooldown timer will be shown in the error message

#### Best Practices
1. **Before Trading**
   - Use `/tcg showcollection` to verify card names and quantities
   - Ensure you have enough copies of cards you want to trade
   - Check that the target user is online and can receive DMs

2. **During Trading**
   - Use exact card names as shown in your collection
   - Keep track of trade IDs for reference
   - Respond to trade offers promptly
   - Cancel unwanted trades to free up cards

3. **After Trading**
   - Verify your collection was updated correctly
   - Keep trade IDs until the trade is completed
   - Report any issues to server administrators

### Technical Stack
- Node.js with Discord.js v13
- MongoDB for data persistence
- Mongoose for data modeling
- Sharp for image processing
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
- `BATTLE_COOLDOWN` - Cooldown between battles in milliseconds (default: 300000, 5 minutes)
- `BATTLE_XP_REWARD` - XP gained from battles (default: 5)

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
BATTLE_COOLDOWN=300000
BATTLE_XP_REWARD=5
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

## Image Processing
The bot uses the Sharp library for image processing with the following features:
- Automatic resizing of card images to consistent dimensions
- Horizontal composition of pack opening images
- Proper padding and spacing between cards
- Discord dark theme background integration
- Placeholder images for cards without images
- Error handling for failed image fetches
- PNG format for optimal quality and transparency

## Recent Updates
- Added visual pack opening display
- Implemented card battle system
- Added card inspection command
- Improved collection viewing with filters
- Added profile command for statistics
- Centralized image processing utilities
- Enhanced error handling and logging
- Added automatic image generation for cards without images
