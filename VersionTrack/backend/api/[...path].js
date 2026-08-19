const app = require('../src/server');
const connectDB = require('../src/config/db');

module.exports = async (req, res) => {
  await connectDB();
  return app(req, res);
};