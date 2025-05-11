require('dotenv').config();

module.exports = {
    adminUserId: process.env.ADMIN_USER_ID,
    defaultCredits: parseInt(process.env.DEFAULT_CREDITS || '10', 10),
    drinkWaterCooldown: parseInt(process.env.DRINK_WATER_COOLDOWN || '43200000', 10), // 12 hours
    packCost: parseInt(process.env.PACK_COST || '5', 10),
    specialChance: parseFloat(process.env.SPECIAL_CHANCE || '0.1'),
    legendaryChance: parseFloat(process.env.LEGENDARY_CHANCE || '0.01'),
    specialPrefix: process.env.SPECIAL_PREFIX || null,
    canGenerateSpecialCards: () => Boolean(process.env.SPECIAL_PREFIX),
    currencyName: process.env.CURRENCY_NAME
};