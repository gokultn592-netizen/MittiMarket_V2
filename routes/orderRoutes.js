const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.post('/', orderController.createOrder);

// Admin routes
router.get('/admin/all', orderController.getAdminOrders);

// User routes (Multi-user support)
router.get('/user/:userId', orderController.getAdminOrders); // We can filter in controller later

module.exports = router;
