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

// Basic Request Logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API Health Check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/farmers', farmerRoutes);

// Compatibility / Legacy Support API
app.get('/api/db', compatibilityController.getFullDb);
app.post('/api/sync', compatibilityController.syncDb);
app.get('/api/admin/farmers', compatibilityController.getAdminFarmers);
app.patch('/api/admin/farmers/:id/verify', compatibilityController.verifyFarmer);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(`[CRITICAL ERROR] ${err.stack}`);
    res.status(500).json({ 
        success: false, 
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
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
