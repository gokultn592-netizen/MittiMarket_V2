const app = require('../app');
const connectDB = require('../config/db');

module.exports = async (req, res) => {
    // Ensure database is connected before handling request
    await connectDB();
    return app(req, res);
};
