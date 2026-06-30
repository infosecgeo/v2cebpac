const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const config = require('./config');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');

// Import routes (will create these next)
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

// Initialize express app
const app = express();

// Trust proxy (for rate limiting, IP detection)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet(config.helmet));

// CORS
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: config.CORS_CREDENTIALS,
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Serve admin dashboard static files
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// API routes
app.use('/api', apiLimiter, apiRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Create server
let server;
if (config.HTTPS_ENABLED && config.HTTPS_CERT_PATH && config.HTTPS_KEY_PATH) {
  // HTTPS server
  try {
    const httpsOptions = {
      cert: fs.readFileSync(config.HTTPS_CERT_PATH),
      key: fs.readFileSync(config.HTTPS_KEY_PATH),
    };
    server = https.createServer(httpsOptions, app);
    logger.info('HTTPS server created');
  } catch (error) {
    logger.error('Failed to create HTTPS server:', error.message);
    logger.info('Falling back to HTTP server');
    server = http.createServer(app);
  }
} else {
  // HTTP server
  server = http.createServer(app);
}

// Start server
function start() {
  server.listen(config.PORT, config.HOST, () => {
    logger.info(`Server started in ${config.NODE_ENV} mode`);
    logger.info(`Listening on ${config.HTTPS_ENABLED ? 'https' : 'http'}://${config.HOST}:${config.PORT}`);
    logger.info(`Admin dashboard: ${config.HTTPS_ENABLED ? 'https' : 'http'}://${config.HOST}:${config.PORT}/admin`);
  });
}

// Graceful shutdown
function shutdown() {
  logger.info('Shutting down server...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Handle process signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  shutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Start the server
if (require.main === module) {
  start();
}

module.exports = { app, server, start, shutdown };
