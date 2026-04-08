const Product = require('../models/Product');
const Farmer = require('../models/Farmer');

exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find().populate({
            path: 'farmer_id',
            select: 'name address location'
        });
        res.json({ success: true, count: products.length, products });
    } catch (error) {
        console.error(`[GetProducts Error] ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const { name, price, category, image_url, farmer_id, stock, description } = req.body || {};
        
        if (!name || !price || !farmer_id) {
            return res.status(400).json({ success: false, message: 'Missing fields: name, price, and farmer_id are required.' });
        }

        const farmer = await Farmer.findById(farmer_id);
        if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found. Only registered farmers can add products.' });

        const product = new Product({
            name,
            price,
            category,
            image_url: image_url || undefined,
            farmer_id,
            stock: stock || 0,
            description
        });

        await product.save();
        res.status(201).json({ success: true, message: 'Product created successfully', product });
    } catch (error) {
        console.error(`[CreateProduct Error] ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
};
