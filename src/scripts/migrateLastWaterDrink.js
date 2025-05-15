const mongoose = require('mongoose');
const UserCredits = require('../models/UserCredits');
require('dotenv').config();

async function migrate() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Update all documents
        const result = await UserCredits.updateMany(
            { lastWaterDrink: { $exists: true } },
            [
                {
                    $set: {
                        lastEarnTime: '$lastWaterDrink',
                        lastWaterDrink: '$$REMOVE'
                    }
                }
            ]
        );

        console.log(`Migration completed. Updated ${result.modifiedCount} documents.`);
        console.log('Migration details:', result);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the migration
migrate(); 