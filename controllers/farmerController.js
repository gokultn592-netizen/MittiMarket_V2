const Farmer = require('../models/Farmer');

exports.getFarmers = async (req, res) => {
    try {
        const farmers = await Farmer.find().populate('user_id', 'name email');
        res.json(farmers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
