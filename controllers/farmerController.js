const Farmer = require('../models/Farmer');

exports.getFarmers = async (req, res) => {
    try {
        const { id } = req.params;
        let farmers;
        
        if (id) {
            farmers = await Farmer.findById(id).populate('user_id', 'name email phone');
            if (!farmers) return res.status(404).json({ success: false, message: 'Farmer not found' });
        } else {
            farmers = await Farmer.find().populate('user_id', 'name email');
        }
        
        res.json({ success: true, count: Array.isArray(farmers) ? farmers.length : 1, data: farmers });
    } catch (error) {
        console.error(`[GetFarmers Error] ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
};
