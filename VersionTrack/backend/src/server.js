const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Route files
const authRoutes = require('./routes/authRoutes');
const documentRoutes = require('./routes/documentRoutes');
const versionRoutes = require('./routes/versionRoutes');
const activityRoutes = require('./routes/activityRoutes');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: '*', // For local development, allow any origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/versions', versionRoutes);
app.use('/api/activities', activityRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ message: 'Resource not found' });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Server error occurred',
  });
});

if (require.main === module) {
  connectDB();

  const server = http.createServer(app);
  const io = socketio(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  const setupCollaboration = require('./sockets/collaboration');
  setupCollaboration(io);

  const PORT = process.env.PORT || 5001;
  server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
}

module.exports = app;
