const Order = require('../models/Order');
const Product = require('../models/Product');

exports.createOrder = async (req, res) => {
    try {
        const { user_id, product_id, quantity } = req.body;

        const product = await Product.findById(product_id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        if (product.stock < quantity) {
            return res.status(400).json({ message: 'Insufficient stock' });
        }

        const order = new Order({
            user_id,
            product_id,
            farmer_id: product.farmer_id,
            quantity,
            total_price: product.price * quantity
        });

        await order.save();

        // Update stock
        product.stock -= quantity;
        await product.save();

        res.status(201).json({ message: 'Order placed successfully', order });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAdminOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate({
                path: 'user_id',
                select: 'name email phone'
            })
            .populate({
                path: 'product_id',
                select: 'name price image_url'
            })
            .populate({
                path: 'farmer_id',
                select: 'name address'
            })
            .sort({ created_at: -1 });
            
        res.json({ success: true, count: orders.length, orders });
    } catch (error) {
        console.error(`[AdminOrders Error] ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
};
