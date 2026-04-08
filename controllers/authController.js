const User = require('../models/User');
const Farmer = require('../models/Farmer');

exports.register = async (req, res) => {
    try {
        const { name, email, password, phone, role, village, district, state, lat, lon } = req.body || {};
        
        if (!name || !phone || !password || !role) {
            return res.status(400).json({ success: false, message: 'Missing required fields: name, phone, password, and role are required.' });
        }

        let user = await User.findOne({ phone });
        if (user) return res.status(400).json({ success: false, message: 'User with this phone number already exists' });

        user = new User({ name, email, password, phone, role });
        await user.save();

        if (role === 'seller' || role === 'farmer') {
            const farmer = new Farmer({
                name,
                address: { village, district, state: state || "Tamil Nadu" },
                location: { lat, lon },
                user_id: user._id
            });
            await farmer.save();
        }

        res.status(201).json({ 
            success: true, 
            message: 'User registered successfully', 
            user: { id: user._id, name: user.name, phone: user.phone, role: user.role } 
        });
    } catch (error) {
        console.error(`[AuthRegister Error] ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { phone, email, password } = req.body;
        
        const query = phone ? { phone, password } : { email, password };
        const user = await User.findOne(query);
        
        if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        res.json({ success: true, message: 'Login successful', user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
