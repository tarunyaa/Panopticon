/**
 * Renewable Energy Benefits API Server
 * Main entry point for the application
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

// Import configurations and middleware
const config = require('./config/config');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');

// Import routes
const benefitsRoutes = require('./routes/benefitsRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const healthRoutes = require('./routes/healthRoutes');

// Initialize Express app
const app = express();

// Database connection
mongoose.connect(config.database.uri, config.database.options)
  .then(() => {
    console.log('Connected to MongoDB successfully');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  });

// Mongoose connection event handlers
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB error:', error.message);
});

// Middleware stack
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(compression()); // Compress responses
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(morgan('combined')); // HTTP request logging

// Apply rate limiting to all routes
app.use(rateLimiter);

// API Routes
const apiPrefix = `${config.api.prefix}/${config.api.version}`;

app.use(`${apiPrefix}/benefits`, benefitsRoutes);
app.use(`${apiPrefix}/categories`, categoryRoutes);
app.use('/health', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Renewable Energy Benefits API',
    version: config.api.version,
    documentation: '/health',
    endpoints: {
      benefits: `${apiPrefix}/benefits`,
      categories: `${apiPrefix}/categories`,
      health: '/health'
    }
  });
});

// 404 handler for undefined routes
app.use((req, res, next) => {
  const error = new Error('Resource not found');
  error.status = 404;
  next(error);
});

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${config.server.env} mode`);
  console.log(`API Documentation available at http://localhost:${PORT}/health`);
});

module.exports = app;
