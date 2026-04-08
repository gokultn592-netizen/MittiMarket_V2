const User = require('../models/User');
const Farmer = require('../models/Farmer');

exports.register = async (req, res) => {
    try {
        const { name, email, password, phone, role, address, location } = req.body;
        
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'User already exists' });

        user = new User({ name, email, password, phone, role });
        await user.save();

        if (role === 'seller') {
            const farmer = new Farmer({
                name,
                address,
                location,
                user_id: user._id
            });
            await farmer.save();
        }

        res.status(201).json({ message: 'User registered successfully', user });
    } catch (error) {
        res.status(500).json({ message: error.message });
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
