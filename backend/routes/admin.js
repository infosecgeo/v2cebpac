const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/adminAuth');
const { adminLimiter } = require('../middleware/rateLimit');

// All admin routes require authentication
router.use(authenticateAdmin);
router.use(adminLimiter);

// Import admin sub-routes (will create these in Phase 7)
// const dashboardRoutes = require('./admin/dashboard');
// const usersRoutes = require('./admin/users');
// const licensesRoutes = require('./admin/licenses');
// const configRoutes = require('./admin/config');
// const transactionsRoutes = require('./admin/transactions');
// const logsRoutes = require('./admin/logs');

// Mount sub-routes
// router.use('/dashboard', dashboardRoutes);
// router.use('/users', usersRoutes);
// router.use('/licenses', licensesRoutes);
// router.use('/config', configRoutes);
// router.use('/transactions', transactionsRoutes);
// router.use('/logs', logsRoutes);

// Root admin endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Cebu Pacific Admin API',
    version: '1.0.0',
    admin: req.admin,
  });
});

module.exports = router;
