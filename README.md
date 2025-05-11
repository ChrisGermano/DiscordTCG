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
