const Product = require('../models/Product');
const Farmer = require('../models/Farmer');

exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find().populate('farmer_id');
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const { name, price, category, image_url, farmer_id, stock, description } = req.body;
        
        // Find farmer to ensure they exist
        const farmer = await Farmer.findById(farmer_id);
        if (!farmer) return res.status(404).json({ message: 'Farmer not found' });

        const product = new Product({
            name,
            price,
            category,
            image_url: image_url || undefined, // Mongoose default will kick in if undefined
            farmer_id,
            stock,
            description
        });

        await product.save();
        res.status(201).json({ message: 'Product created successfully', product });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
