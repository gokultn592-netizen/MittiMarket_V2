const User = require('../models/User');
const Farmer = require('../models/Farmer');

exports.register = async (req, res) => {
    try {
        const { name, email, password, phone, role, address, location } = req.body || {};
        
        if (!name || !email || !password || !role) {
            return res.status(400).json({ success: false, message: 'Missing required fields: name, email, password, and role are required.' });
        }

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ success: false, message: 'User already exists' });

        user = new User({ name, email, password, phone, role });
        await user.save();

        if (role === 'seller' || role === 'farmer') {
            const farmer = new Farmer({
                name,
                address,
                location,
                user_id: user._id
            });
            await farmer.save();
        }

        res.status(201).json({ 
            success: true, 
            message: 'User registered successfully', 
            user: { id: user._id, name: user.name, email: user.email, role: user.role } 
        });
    } catch (error) {
        console.error(`[AuthRegister Error] ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email, password });
        
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        res.json({ message: 'Login successful', user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
