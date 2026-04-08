const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Farmer = require('../models/Farmer');

exports.getFullDb = async (req, res) => {
    try {
        const [products, users, orders] = await Promise.all([
            Product.find().lean(),
            User.find().lean(),
            Order.find().populate('user_id product_id farmer_id').lean()
        ]);

        // Map Mongoose _id to id if frontend expects 'id'
        const mappedProducts = products.map(p => ({ 
            ...p, 
            id: p.id || p._id,
            farmerId: p.farmer_id || p.farmerId,
            img: p.image_url || p.img || "https://loremflickr.com/400/300/farm,fresh"
        }));
        
        const mappedUsers = users.map(u => ({ ...u, id: u.id || u._id }));
        
        const mappedOrders = orders.map(o => ({ 
            ...o, 
            id: o.order_id || o._id,
            buyerName: o.user_id ? o.user_id.name : 'Unknown',
            total: o.total_price || o.total
        }));

        res.json({
            products: mappedProducts,
            users: mappedUsers,
            orders: mappedOrders,
            carts: {},
            wishlists: {},
            nextProductId: 1000, 
            nextUserId: 1000,
            nextOrderId: 1000
        });
    } catch (error) {
        console.error(`[FullDb Error] ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.syncDb = async (req, res) => {
    try {
        const incomingDb = req.body;
        if (!incomingDb) return res.status(400).json({ success: false, message: 'No data provided for sync' });

        console.log(`[Sync] Processing sync for ${incomingDb.products?.length || 0} products and ${incomingDb.orders?.length || 0} orders`);

        // Selective persistence (In a production app, we would use proper REST routes, but this ensures legacy support works)
        if (incomingDb.products && Array.isArray(incomingDb.products)) {
            for (const p of incomingDb.products) {
                if (p.name && p.price) {
                    await Product.findOneAndUpdate(
                        { name: p.name }, // Use name as unique key for legacy logic
                        { ...p },
                        { upsert: true, new: true }
                    );
                }
            }
        }

        if (incomingDb.orders && Array.isArray(incomingDb.orders)) {
            for (const o of incomingDb.orders) {
                if (o.total && o.items) {
                    // Map frontend fields (buyerId, items) to Mongoose fields (user_id, product_id)
                    const orderData = {
                        order_id: o.id || o.order_id || `ORD-${Date.now()}`,
                        user_id: o.buyerId || o.user_id,
                        total_price: o.total,
                        status: o.status || 'pending',
                        items: o.items // Keep items as is or map if needed
                    };

                    // For the first item, we can populate the root product_id and farmer_id if schema requires it
                    if (o.items[0]) {
                        orderData.product_id = o.items[0].productId || o.items[0].product_id;
                        orderData.farmer_id = o.items[0].farmerId || o.items[0].farmer_id;
                        orderData.quantity = o.items[0].quantity;
                    }

                    await Order.findOneAndUpdate(
                        { order_id: orderData.order_id }, 
                        { $set: orderData },
                        { upsert: true, new: true }
                    );
                }
            }
        }

        res.json({ success: true, message: 'Cloud Database Synchronized Successfully' });
    } catch (error) {
        console.error(`[Sync Error] ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
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
