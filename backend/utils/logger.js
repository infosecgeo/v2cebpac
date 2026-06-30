const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');

// Ensure log directory exists
if (!fs.existsSync(config.LOG_PATH)) {
  fs.mkdirSync(config.LOG_PATH, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create transports array
const transports = [];

// Console transport
if (config.LOG_CONSOLE_ENABLED) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: config.LOG_LEVEL,
    })
  );
}

// File transports
if (config.LOG_FILE_ENABLED) {
  // Combined log
  transports.push(
    new winston.transports.File({
      filename: path.join(config.LOG_PATH, 'app.log'),
      format: logFormat,
      level: config.LOG_LEVEL,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );

  // Error log
  transports.push(
    new winston.transports.File({
      filename: path.join(config.LOG_PATH, 'error.log'),
      format: logFormat,
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );
}

// Create logger
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Add stream for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;
