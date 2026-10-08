const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/admin');
const controller = require('../controllers/adminController');
const { auditAdminAction } = require('../services/adminActivity');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(verifyToken, requireSuperAdmin, auditAdminAction);

router.get('/dashboard', asyncHandler(controller.getDashboard));
router.get('/admins', asyncHandler(controller.getAdminAccounts));
router.post('/admins', asyncHandler(controller.createAdmin));
router.get('/admins/:id', asyncHandler(controller.getAdminAccount));
router.put('/admins/:id', asyncHandler(controller.updateAdmin));
router.patch('/admins/:id', asyncHandler(controller.updateAdmin));
router.patch('/admins/:id/status', asyncHandler(controller.updateAdminStatus));
router.patch('/admins/:id/permissions', asyncHandler(controller.updateAdminPermissions));
router.post('/admins/:id/reset-password', asyncHandler(controller.resetAdminPassword));
router.delete('/admins/:id', asyncHandler(controller.removeAdmin));
router.get('/activity', asyncHandler(controller.getAdminActivity));
router.get('/work', asyncHandler(controller.getAdminWorkOverview));
router.get('/reports', asyncHandler(controller.getReports));
router.get('/system-settings', asyncHandler(controller.getSystemSettings));

module.exports = router;
