const express = require('express');
const router = express.Router();

// Import sub-routes
const authRoutes = require('./api/auth');
const configRoutes = require('./api/config');
const creditsRoutes = require('./api/credits');
const transactionsRoutes = require('./api/transactions');

// Mount sub-routes
router.use('/auth', authRoutes);
router.use('/config', configRoutes);
router.use('/credits', creditsRoutes);
router.use('/transactions', transactionsRoutes);

// Root API endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Cebu Pacific Backend API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      config: '/api/config',
      credits: '/api/credits',
      transactions: '/api/transactions',
    },
  });
});

module.exports = router;
