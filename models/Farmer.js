const mongoose = require('mongoose');

const farmerSchema = new mongoose.Schema({
    farmer_id: {
        type: String,
        required: true,
        unique: true,
        default: () => `FRM-${Math.floor(1000 + Math.random() * 9000)}`
    },
    name: {
        type: String,
        required: true
    },
    address: {
        village: String,
        district: String,
        state: String
    },
    location: {
        lat: Number,
        lng: Number
    },
    verified: {
        type: Boolean,
        default: false
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Farmer', farmerSchema);
