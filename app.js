const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
require('dotenv').config();

// Route imports
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const farmerRoutes = require('./routes/farmerRoutes');
const compatibilityController = require('./controllers/compatibilityController');

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/farmers', farmerRoutes);

// Compatibility / Legacy Support API
app.get('/api/db', compatibilityController.getFullDb);
app.post('/api/sync', compatibilityController.syncDb);
app.get('/api/admin/farmers', compatibilityController.getAdminFarmers);
app.patch('/api/admin/farmers/:id/verify', compatibilityController.verifyFarmer);

// Root route
app.get('/', (req, res) => {
    res.send('MittiMart API is running...');
});

// 404 Handler for missing API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ message: `API route ${req.originalUrl} not found` });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(`[Error] ${err.stack}`);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

module.exports = app;
