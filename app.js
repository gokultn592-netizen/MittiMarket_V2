const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
require('dotenv').config();

// Route imports
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const farmerRoutes = require('./routes/farmerRoutes');

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Main logical routes
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/farmers', farmerRoutes);

// Admin alias for orders
app.use('/admin/orders', (req, res, next) => {
    req.url = '/admin'; 
    next();
}, orderRoutes);

// Serve static assets if public folder exists
const path = require('path');
const fs = require('fs');
app.use(express.static(path.join(__dirname, 'public')));

// Root route
app.get('/', (req, res) => {
    res.send('MittiMart API is running...');
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

module.exports = app;
