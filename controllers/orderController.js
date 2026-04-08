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
            .populate('user_id', 'name email')
            .populate('product_id', 'name price')
            .populate('farmer_id', 'name address');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
