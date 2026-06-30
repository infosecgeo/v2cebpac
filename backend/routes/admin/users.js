const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { asyncHandler } = require('../../middleware/errorHandler');
const { requireSuperadmin } = require('../../middleware/adminAuth');
const Response = require('../../utils/response');
const UserService = require('../../storage/services/UserService');
const { USER_ROLE, ERROR_CODE } = require('../../config/constants');
const security = require('../../config/security');
const logger = require('../../utils/logger');

/**
 * GET /api/admin/users
 * List all admin users
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { role, isActive, query, sortBy, sortOrder, limit } = req.query;

    const filters = {};

    if (role) {
      filters.role = role;
    }
    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }
    if (query) {
      filters.query = query;
    }
    if (sortBy) {
      filters.sortBy = sortBy;
    }
    if (sortOrder) {
      filters.sortOrder = sortOrder;
    }
    if (limit) {
      filters.limit = parseInt(limit, 10);
    }

    const users = await UserService.list(filters);

    // Remove password hashes from response
    const sanitizedUsers = users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      email: u.email,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      isActive: u.isActive,
    }));

    logger.info(`Users listed by admin: ${req.admin.username}`);

    return Response.success(res, {
      users: sanitizedUsers,
      total: sanitizedUsers.length,
    });
  })
);

/**
 * GET /api/admin/users/:id
 * Get a specific user by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await UserService.getById(id);
    if (!user) {
      return Response.notFound(res, 'User not found');
    }

    // Remove password hash from response
    const sanitizedUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      isActive: user.isActive,
    };

    return Response.success(res, { user: sanitizedUser });
  })
);

/**
 * POST /api/admin/users
 * Create a new admin user (superadmin only)
 */
router.post(
  '/',
  requireSuperadmin,
  asyncHandler(async (req, res) => {
    const { username, password, role, email } = req.body;

    // Validate required fields
    if (!username || !password) {
      return Response.error(res, ERROR_CODE.VALIDATION_ERROR, 'Missing required fields: username, password', 400);
    }

    // Validate password strength
    if (password.length < security.password.minLength) {
      return Response.error(
        res,
        ERROR_CODE.VALIDATION_ERROR,
        `Password must be at least ${security.password.minLength} characters`,
        400
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, security.bcrypt.saltRounds);

    // Create user
    const user = await UserService.create({
      username,
      passwordHash,
      role: role || USER_ROLE.ADMIN,
      email: email || null,
      isActive: true,
    });

    // Remove password hash from response
    const sanitizedUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      isActive: user.isActive,
    };

    logger.info(`User created by admin: ${req.admin.username}`, { userId: user.id });

    return Response.success(res, { user: sanitizedUser }, 201);
  })
);

/**
 * PATCH /api/admin/users/:id
 * Update an admin user
 */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { username, password, role, email, isActive } = req.body;

    // Check if user exists
    const existingUser = await UserService.getById(id);
    if (!existingUser) {
      return Response.notFound(res, 'User not found');
    }

    // Only superadmin can update role or change superadmin accounts
    if ((role && role !== existingUser.role) || existingUser.role === USER_ROLE.SUPERADMIN) {
      if (req.admin.role !== USER_ROLE.SUPERADMIN) {
        return Response.forbidden(res, 'Superadmin access required for this operation');
      }
    }

    const updates = {};

    if (username) {
      updates.username = username;
    }
    if (password) {
      if (password.length < security.password.minLength) {
        return Response.error(
          res,
          ERROR_CODE.VALIDATION_ERROR,
          `Password must be at least ${security.password.minLength} characters`,
          400
        );
      }
      updates.passwordHash = await bcrypt.hash(password, security.bcrypt.saltRounds);
    }
    if (role) {
      updates.role = role;
    }
    if (email !== undefined) {
      updates.email = email;
    }
    if (isActive !== undefined) {
      updates.isActive = isActive;
    }

    // Update user
    const updatedUser = await UserService.update(id, updates);

    // Remove password hash from response
    const sanitizedUser = {
      id: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
      email: updatedUser.email,
      createdAt: updatedUser.createdAt,
      lastLoginAt: updatedUser.lastLoginAt,
      isActive: updatedUser.isActive,
    };

    logger.info(`User updated by admin: ${req.admin.username}`, { userId: id });

    return Response.success(res, { user: sanitizedUser });
  })
);

/**
 * DELETE /api/admin/users/:id
 * Delete an admin user (superadmin only)
 */
router.delete(
  '/:id',
  requireSuperadmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Prevent self-deletion
    if (req.admin.userId === id) {
      return Response.error(res, ERROR_CODE.VALIDATION_ERROR, 'Cannot delete your own account', 400);
    }

    // Check if user exists
    const user = await UserService.getById(id);
    if (!user) {
      return Response.notFound(res, 'User not found');
    }

    // Delete user
    await UserService.delete(id);

    logger.info(`User deleted by admin: ${req.admin.username}`, { userId: id });

    return Response.success(res, { message: 'User deleted successfully' });
  })
);

module.exports = router;
