const ADMIN_SECTION_KEYS = [
  'dashboard',
  'chamberMembership',
  'chamberApprovals',
  'chamberDocuments',
  'qrCodes',
  'jobs',
  'jobApprovals',
  'jobApplications',
  'businesses',
  'businessApprovals',
  'news',
  'advertisements',
  'offers',
  'users',
  'reports',
];

const DEFAULT_ADMIN_PERMISSIONS = Object.fromEntries(ADMIN_SECTION_KEYS.map((section) => [section, section === 'dashboard']));

const normalizeAdminPermissions = (user = {}) => {
  const permissions = { ...DEFAULT_ADMIN_PERMISSIONS };
  const source = user?.permissions || {};

  Object.entries(source).forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(permissions, key)) {
      permissions[key] = !!value;
    }
  });

  return permissions;
};

const hasAdminSectionAccess = (user, section) => {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (user.role !== 'admin') return false;
  if (section === 'dashboard') return true;

  const permissions = normalizeAdminPermissions(user);
  return !!permissions[section];
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  if (req.user.status !== 'active' || req.user.isActive === false) {
    return res.status(403).json({ message: 'Active admin access required.' });
  }

  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'super_admin' || req.user.status !== 'active' || req.user.isActive === false) {
    return res.status(403).json({ message: 'Super Admin access required.' });
  }
  next();
};

const requireAdminSection = (section) => (req, res, next) => {
  if (!hasAdminSectionAccess(req.user, section)) {
    return res.status(403).json({ message: 'You do not have access to this admin section.' });
  }

  next();
};

const requireAnyAdminSection = (...sections) => (req, res, next) => {
  if (!sections.some((section) => hasAdminSectionAccess(req.user, section))) {
    return res.status(403).json({ message: 'You do not have access to this admin section.' });
  }
  next();
};

module.exports = {
  requireAdmin,
  requireSuperAdmin,
  requireAdminSection,
  requireAnyAdminSection,
  normalizeAdminPermissions,
  DEFAULT_ADMIN_PERMISSIONS,
  ADMIN_SECTION_KEYS,
  hasAdminSectionAccess,
};
