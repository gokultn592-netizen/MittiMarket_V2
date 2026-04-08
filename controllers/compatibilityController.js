const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Farmer = require('../models/Farmer');

exports.getFullDb = async (req, res) => {
    try {
        const [products, users, orders] = await Promise.all([
            Product.find().lean(),
            User.find().lean(),
            Order.find().lean()
        ]);

        // Map Mongoose _id to id if frontend expects 'id'
        const mappedProducts = products.map(p => ({ ...p, id: p.id || p._id }));
        const mappedUsers = users.map(u => ({ ...u, id: u.id || u._id }));
        const mappedOrders = orders.map(o => ({ ...o, id: o.id || o._id }));

        res.json({
            products: mappedProducts,
            users: mappedUsers,
            orders: mappedOrders,
            carts: {}, // Carts are usually session/user based now
            wishlists: {},
            nextProductId: 1000,
            nextUserId: 1000,
            nextOrderId: 1000
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.syncDb = async (req, res) => {
    // For serverless, we don't want to overwrite the whole DB from a client sync.
    // We just return success to keep the frontend happy, or we could implement partial sync.
    console.log('Sync requested from frontend');
    res.json({ message: 'Sync acknowledged (using persistent MongoDB)' });
};

exports.getAdminFarmers = async (req, res) => {
    try {
        const farmers = await Farmer.find().lean();
        res.json(farmers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.verifyFarmer = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, review } = req.body;
        const farmer = await Farmer.findByIdAndUpdate(
            id,
            { qualityStatus: status, qualityReview: review },
            { new: true }
        );
        if (!farmer) return res.status(404).json({ error: 'Farmer not found' });
        res.json(farmer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
