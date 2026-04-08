const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const Product = require('./models/Product');
const Farmer = require('./models/Farmer');
const User = require('./models/User');

dotenv.config();

async function migrate() {
    try {
        await connectDB();

        // 1. Ensure a default farmer exists to own these legacy products
        let defaultAdmin = await User.findOne({ role: 'admin' });
        if (!defaultAdmin) {
            console.log("Creating default Admin user...");
            defaultAdmin = new User({
                name: "Admin",
                email: "admin@mittimart.com",
                password: "adminpassword",
                role: "admin"
            });
            await defaultAdmin.save();
        }

        let defaultFarmer = await Farmer.findOne({ user_id: defaultAdmin._id });
        if (!defaultFarmer) {
            console.log("Creating default Farmer profile for Admin...");
            defaultFarmer = new Farmer({
                name: "MittiMart Warehouse",
                address: { village: "Central", district: "Chennai", state: "Tamil Nadu" },
                location: { lat: 13.08, lng: 80.27 },
                verified: true,
                user_id: defaultAdmin._id
            });
            await defaultFarmer.save();
        }

        const dbPath = path.join(__dirname, 'database.json');
        if (!fs.existsSync(dbPath)) {
            console.error("ERROR: database.json not found in root.");
            process.exit(1);
        }

        const rawData = fs.readFileSync(dbPath, 'utf8');
        const dbJson = JSON.parse(rawData);
        const products = dbJson.products || [];

        console.log(`Found ${products.length} products in database.json.`);

        for (const p of products) {
            // Check if already exists by name (since old IDs might not map perfectly)
            const existing = await Product.findOne({ name: p.name });
            if (existing) {
                console.log(`- Skipping ${p.name} (Already exists)`);
            } else {
                await Product.create({
                    name: p.name,
                    price: p.price || 0,
                    category: p.category || "General",
                    image_url: p.img || undefined,
                    farmer_id: defaultFarmer._id,
                    stock: p.stock || 10,
                    description: p.description || ""
                });
                console.log(`+ Migrated: ${p.name}`);
            }
        }

        console.log("\nMigration completed successfully!");
        process.exit(0);

    } catch (err) {
        console.error("MIGRATION ERROR:", err);
        process.exit(1);
    }
}

migrate();
