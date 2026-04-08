const express = require('express');
const router = express.Router();
const farmerController = require('../controllers/farmerController');
const authController = require('../controllers/authController');

// Registration redirect (Compatibility for frontend calling /farmers/register)
router.post('/register', authController.register);

// Farmer listing and profiles
router.get('/', farmerController.getFarmers);
router.get('/:id', farmerController.getFarmers); // Can be reused for single farmer

module.exports = router;
