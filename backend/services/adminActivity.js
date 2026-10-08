const AdminActivity = require('../models/AdminActivity');

const logAdminActivity = (activity) => AdminActivity.create(activity).catch((error) => {
  console.error('Admin activity log error:', error.message);
});

const sectionForRequest = (path, body = {}) => {
  if (path.startsWith('/admins')) return 'Admin Management';
  if (path.startsWith('/reports')) return 'Reports';
  if (path.startsWith('/chamber-members') && path.includes('/qr/')) return 'QR Codes';
  if (path.startsWith('/resumes')) return 'Chamber Member Documents';
  if (path.startsWith('/system-settings')) return 'System Settings';
  if (path.startsWith('/chamber-members')) {
    return ['/approve', '/reject'].some((action) => path.endsWith(action))
      || ['active', 'rejected'].includes(body.status) ? 'Chamber Membership Approval' : 'Chamber Membership';
  }
  if (path.startsWith('/all-members-qr') || path.startsWith('/qr-codes')) return 'QR Codes';
  if (path.startsWith('/jobs')) return body.status && ['published', 'rejected'].includes(body.status) ? 'Job Approvals' : 'Jobs';
  if (path.startsWith('/applications')) return 'Job Applications';
  if (path.startsWith('/businesses')) return ['approved', 'rejected'].includes(body.status) ? 'Business Approvals' : 'Business Listings';
  if (path.startsWith('/news') || path.startsWith('/community-updates')) return 'News';
  if (path.startsWith('/ads')) return 'Advertisements';
  if (path.startsWith('/offers')) return 'Offers';
  if (path.startsWith('/users')) return 'Users';
  return 'Dashboard';
};

const actionForRequest = (method, path, body = {}) => {
  const methodName = method.toUpperCase();
  if (methodName === 'GET') return `Viewed ${body.adminAuditSection || sectionForRequest(path, body)}`;
  if (path.startsWith('/admins') && methodName === 'DELETE') return 'Removed Admin';
  if (methodName === 'DELETE') return 'Deleted Record';
  if (path.includes('/permissions')) return 'Updated Admin Permissions';
  if (path.startsWith('/admins') && methodName === 'POST') return 'Created Admin';
  if (path.startsWith('/admins') && ['PATCH', 'PUT'].includes(methodName) && !path.includes('/permissions') && !path.endsWith('/password') && !path.endsWith('/status')) return 'Updated Admin';
  if (path.startsWith('/admins') && body.status === 'active') return 'Activated Admin';
  if (path.startsWith('/admins') && body.status === 'suspended') return 'Deactivated Admin';
  if (path.startsWith('/admins') && (path.endsWith('/password') || path.endsWith('/reset-password'))) return 'Reset Admin Password';
  if (path.startsWith('/news') && methodName === 'POST') return 'Created News';
  if (path.startsWith('/news') && ['PATCH', 'PUT'].includes(methodName)) return 'Updated News';
  if (path.startsWith('/ads') && methodName === 'POST') return 'Created Advertisement';
  if (path.startsWith('/ads') && ['PATCH', 'PUT'].includes(methodName)) return 'Updated Advertisement';
  if (path.startsWith('/chamber-members') && body.status === 'active') return 'Approved Membership';
  if (path.startsWith('/chamber-members') && body.status === 'rejected') return 'Rejected Membership';
  if (path.startsWith('/jobs') && body.status === 'published') return 'Approved Job';
  if (path.startsWith('/jobs') && body.status === 'rejected') return 'Rejected Job';
  if (path.startsWith('/businesses') && body.status === 'approved') return 'Approved Business';
  if (path.startsWith('/businesses') && body.status === 'rejected') return 'Rejected Business';
  if (body.status === 'rejected') return 'Rejected Record';
  if (body.status === 'active' || body.status === 'published' || body.status === 'approved') return 'Approved Record';
  if (methodName === 'POST') return 'Created Record';
  if (methodName === 'PATCH' || methodName === 'PUT') return 'Updated Record';
  return `${methodName} Record`;
};

const auditAdminAction = (req, res, next) => {
  if (['/health', '/dashboard', '/admin-work', '/admin-activity', '/my-activity', '/activity', '/work'].includes(req.path)) return next();

  res.on('finish', () => {
    const targetType = req.adminAuditTargetType || req.path.split('/').filter(Boolean)[0] || '';
    const targetId = req.params?.id || req.path.split('/').find((segment) => /^[a-f\d]{24}$/i.test(segment)) || '';
    const targetDescription = targetId ? `${targetType} record ${targetId}` : targetType;
    logAdminActivity({
      adminId: req.user._id || req.user.userId,
      adminName: req.user.name || 'Admin',
      section: req.adminAuditSection || sectionForRequest(req.path, req.body),
      action: actionForRequest(req.method, req.path, { ...req.body, adminAuditSection: req.adminAuditSection }),
      targetId,
      targetType,
      description: `${req.method} ${req.originalUrl}${targetDescription ? ` (${targetDescription})` : ''}`,
      status: res.statusCode < 400 ? 'completed' : 'failed',
    });
  });

  next();
};

module.exports = { logAdminActivity, auditAdminAction };