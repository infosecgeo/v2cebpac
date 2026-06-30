#!/usr/bin/env node

/**
 * Database Initialization Script
 * Initializes all database files with default data
 * Usage: node scripts/init-database.js [--force]
 */

require('dotenv').config();
const DatabaseInitializer = require('../storage/DatabaseInitializer');
const logger = require('../utils/logger');

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  try {
    logger.info('='.repeat(60));
    logger.info('Database Initialization Script');
    logger.info('='.repeat(60));
    
    if (force) {
      logger.warn('FORCE mode enabled - existing data will be overwritten!');
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise((resolve) => {
        readline.question('Are you sure you want to reinitialize all databases? (yes/no): ', resolve);
      });
      
      readline.close();
      
      if (answer.toLowerCase() !== 'yes') {
        logger.info('Operation cancelled');
        process.exit(0);
      }
    }
    
    const initializer = new DatabaseInitializer();
    const results = await initializer.initializeAll(force);
    
    logger.info('');
    logger.info('Initialization Results:');
    logger.info(`  Created: ${results.created.length} file(s)`);
    if (results.created.length > 0) {
      results.created.forEach(file => logger.info(`    ✓ ${file}`));
    }
    
    logger.info(`  Skipped: ${results.skipped.length} file(s)`);
    if (results.skipped.length > 0) {
      results.skipped.forEach(file => logger.info(`    - ${file}`));
    }
    
    if (results.errors.length > 0) {
      logger.error(`  Errors: ${results.errors.length} file(s)`);
      results.errors.forEach(err => logger.error(`    ✗ ${err.file}: ${err.error}`));
    }
    
    logger.info('');
    logger.info('Default Admin Credentials:');
    logger.info(`  Username: (check .env file for ADMIN_USERNAME)`);
    logger.info(`  Password: (check .env file for ADMIN_PASSWORD)`);
    logger.info('');
    logger.info('⚠️  IMPORTANT: Change the default admin password immediately!');
    logger.info('');
    logger.info('Admin Login: http://localhost:3000/admin/login.html');
    logger.info('='.repeat(60));
    
    process.exit(0);
  } catch (error) {
    logger.error('Initialization failed:', error);
    process.exit(1);
  }
}

main();
