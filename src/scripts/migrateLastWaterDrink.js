const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

async function migrateLastWaterDrink() {
    try {
        const UserCollection = require('../models/UserCollection');
        const Card = require('../models/Card');

        const waterDrinkCard = await Card.findOne({ name: 'Water Drink' });
        if (!waterDrinkCard) {
            console.log('Water Drink card not found in database');
            return;
        }

        const result = await UserCollection.updateMany(
            { 'cards.cardId': waterDrinkCard._id },
            { $set: { 'cards.$.lastUsed': new Date(0) } }
        );

        console.log(`Updated ${result.modifiedCount} collections`);
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

migrateLastWaterDrink(); 