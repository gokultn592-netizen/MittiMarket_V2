const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    product_id: {
        type: String,
        required: true,
        unique: true,
        default: () => `PRD-${Math.floor(1000 + Math.random() * 9000)}`
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    image_url: {
        type: String,
        default: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=1000&auto=format&fit=crop'
    },
    farmer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Farmer',
        required: true
    },
    stock: {
        type: Number,
        default: 0
    },
    description: String,
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Product', productSchema);
