const mongoose = require('mongoose');
require('dotenv').config();

let isConnected = false; // Track connection state

const connectDB = async () => {
    if (isConnected) {
        console.log('=> Using existing MongoDB connection');
        return;
    }

    console.log('=> Creating new MongoDB connection');
    try {
        const db = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mittimart', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        isConnected = db.connections[0].readyState;
        console.log(`MongoDB Connected: ${db.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        // Do not process.exit in serverless!
        throw error;
    }
};

module.exports = connectDB;
