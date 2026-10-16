const express = require('express');
const { verifyToken } = require('../middleware/auth');
const ChamberMembership = require('../models/ChamberMembership');
const User = require('../models/User');
const controller = require('../controllers/resumeController');
const { hasAdminSectionAccess } = require('../middleware/admin');
const { auditAdminAction } = require('../services/adminActivity');

const router = express.Router();
const allowedRoles = new Set(['admin', 'super_admin', 'chamber_member']);
router.use(verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('role status');
    if (!user || !allowedRoles.has(user.role) || user.status !== 'active') {
      return res.status(403).json({ message: 'Resume access is restricted to active Admins and paid Chamber Members.' });
    }

    if (['admin', 'super_admin'].includes(user.role) && !hasAdminSectionAccess(req.user, 'chamberDocuments')) {
      return res.status(403).json({ message: 'You do not have access to member documents.' });
    }

    if (!['admin', 'super_admin', 'chamber_member'].includes(user.role)) {
      const now = new Date();
      const membership = await ChamberMembership.exists({
        user: user._id,
        status: 'active',
        $or: [
          { membershipExpiryDate: { $gte: now } },
          { membershipExpiryDate: { $exists: false }, expiresAt: { $gte: now } },
        ],
      });
      if (!membership) {
        return res.status(403).json({ message: 'An active Chamber Membership is required to access resumes.' });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});
router.use((req, res, next) => {
  if (!['admin', 'super_admin'].includes(req.user?.role)) return next();
  req.adminAuditSection = 'Chamber Member Documents';
  req.adminAuditTargetType = 'Resume';
  return auditAdminAction(req, res, next);
});
router.get('/', controller.listResumes);
router.get('/:id/cv', controller.getResume);

module.exports = router;
