const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const User = require('../models/User');
const Business = require('../models/Business');
const ChamberMembership = require('../models/ChamberMembership');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const News = require('../models/News');
const Offer = require('../models/Offer');
const Ad = require('../models/Ad');
const HeroSlide = require('../models/HeroSlide');
const { downloadPublicImage, storeDownloadedImage, readImageDimensions } = require('../services/linkedImage');
const { convertImageLink } = require('../utils/imageLink');
const { parseKolkataDate } = require('../utils/kolkataTime');
const Notification = require('../models/Notification');
const QrCode = require('../models/QrCode');
const CommunityUpdate = require('../models/CommunityUpdate');
const AdminActivity = require('../models/AdminActivity');
const { issueMembershipNumber, ensureMembershipQr: provisionMembershipQr, expireElapsedMemberships, buildPublicUrl } = require('../services/chamberMembership');
const { ADMIN_SECTION_KEYS, DEFAULT_ADMIN_PERMISSIONS } = require('../middleware/admin');

const USER_ROLES = ['shop_owner', 'job_seeker', 'chamber_member'];
const USER_STATUSES = ['pending', 'active', 'suspended', 'rejected'];
const BUSINESS_STATUSES = ['pending', 'approved', 'rejected', 'suspended'];
const MEMBERSHIP_STATUSES = ['pending', 'active', 'rejected', 'expired', 'suspended'];
const JOB_STATUSES = ['pending', 'published', 'rejected', 'closed'];
const APPLICATION_STATUSES = ['submitted', 'eligible', 'not_eligible', 'shortlisted', 'rejected'];
const NEWS_STATUSES = ['draft', 'published', 'archived'];
const COMMUNITY_UPDATE_STATUSES = ['active', 'inactive'];
const OFFER_STATUSES = ['draft', 'published', 'expired'];
const QR_STATUSES = ['active', 'disabled', 'inactive'];

const safeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  isActive: user.isActive !== false,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const safeAdmin = (user) => ({ ...safeUser(user), permissions: user.permissions || DEFAULT_ADMIN_PERMISSIONS });

const isValidId = (id) => mongoose.isValidObjectId(id);
const requireValidId = (id) => {
  if (!isValidId(id)) {
    const error = new Error('Invalid resource ID.');
    error.statusCode = 400;
    throw error;
  }
};

const getPagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const paginationResponse = (data, page, limit, total) => ({
  data,
  pagination: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
});

const getAdminActivitySummaries = async (adminIds) => {
  if (!adminIds.length) return new Map();
  const summaries = await AdminActivity.aggregate([
    { $match: { adminId: { $in: adminIds } } },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: '$adminId',
        lastActivity: { $first: '$timestamp' },
        lastLogin: { $max: { $cond: [{ $eq: ['$action', 'LOGIN'] }, '$timestamp', null] } },
        lastLogout: { $max: { $cond: [{ $eq: ['$action', 'LOGOUT'] }, '$timestamp', null] } },
      },
    },
  ]);
  return new Map(summaries.map((summary) => [String(summary._id), summary]));
};

const searchFilter = (search, fields) => {
  if (!search || !search.trim()) return {};
  const expression = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return { $or: fields.map((field) => ({ [field]: expression })) };
};

const validateEnum = (value, allowed, field) => {
  if (!allowed.includes(value)) {
    const error = new Error(`Invalid ${field}.`);
    error.statusCode = 400;
    throw error;
  }
};

const getOneOr404 = async (Model, id, populate = []) => {
  requireValidId(id);
  let query = Model.findById(id);
  populate.forEach((path) => { query = query.populate(path); });
  const record = await query;
  if (!record) {
    const error = new Error('Resource not found.');
    error.statusCode = 404;
    throw error;
  }
  return record;
};

const protectAdminAccount = async (target, changes, actorId) => {
  const actorIsSuperAdmin = await User.findById(actorId).then((user) => user?.role === 'super_admin');

  if (['admin', 'super_admin'].includes(target.role) && !actorIsSuperAdmin) {
    const error = new Error('Only the Super Admin can manage administrator accounts.');
    error.statusCode = 403;
    throw error;
  }

  if (target.role === 'super_admin' && (changes.role || changes.status || changes.delete)) {
    const error = new Error('The Super Admin account cannot be changed or removed here.');
    error.statusCode = 403;
    throw error;
  }

  const isSelf = target._id.toString() === actorId.toString();
  if (isSelf && (changes.role && changes.role !== 'admin' && changes.role !== 'super_admin' || changes.status && changes.status !== 'active')) {
    const error = new Error('An administrator cannot remove their own active admin access.');
    error.statusCode = 400;
    throw error;
  }

  const targetIsAdminRole = target.role === 'admin';
  const becomesInactiveAdmin = targetIsAdminRole &&
    ((changes.role && changes.role !== 'admin') || (changes.status && changes.status !== 'active') || changes.delete);
  if (becomesInactiveAdmin) {
    const activeAdmins = await User.countDocuments({ role: { $in: ['admin', 'super_admin'] }, status: 'active', isActive: { $ne: false } });
    if (activeAdmins <= 1) {
      const error = new Error('The final active administrator cannot be demoted or deactivated.');
      error.statusCode = 400;
      throw error;
    }
  }
};

const getAdminAccounts = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { role: 'admin' };
  const [admins, total] = await Promise.all([
    User.find(filter).select('_id name email phone role status isActive permissions createdAt updatedAt').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  const activitySummaries = await getAdminActivitySummaries(admins.map((admin) => admin._id));
  res.json(paginationResponse(admins.map((admin) => {
    const activity = activitySummaries.get(String(admin._id));
    return {
      ...safeAdmin(admin),
      lastActivity: activity?.lastActivity || null,
      lastLogin: activity?.lastLogin || null,
      lastLogout: activity?.lastLogout || null,
    };
  }), page, limit, total));
};

const createAdmin = async (req, res) => {
  const { name, email, phone, password, status = 'active', permissions = {} } = req.body || {};
  if ([name, email, phone].some((value) => typeof value !== 'string' || !value.trim()) || typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'Name, email, phone, and temporary password are required.' });
  }
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    return res.status(400).json({ message: 'Assigned sections must be provided as a permissions object.' });
  }
  if (password.length < 8) return res.status(400).json({ message: 'Temporary password must be at least 8 characters.' });
  if (!['active', 'suspended'].includes(status)) return res.status(400).json({ message: 'Admin status must be active or suspended.' });

  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'A user with this email already exists.' });

  const assignedPermissions = Object.fromEntries(ADMIN_SECTION_KEYS.map((section) => [section, section === 'dashboard' || permissions[section] === true]));
  const admin = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    phone: phone.trim(),
    passwordHash: await bcrypt.hash(password, 12),
    role: 'admin',
    status,
    isActive: status === 'active',
    permissions: assignedPermissions,
  });
  res.status(201).json({ admin: safeAdmin(admin) });
};

const getAdminAccount = async (req, res) => {
  const admin = await getOneOr404(User, req.params.id);
  if (admin.role !== 'admin') return res.status(404).json({ message: 'Admin not found.' });
  const activity = (await getAdminActivitySummaries([admin._id])).get(String(admin._id));
  res.json({ admin: {
    ...safeAdmin(admin),
    lastActivity: activity?.lastActivity || null,
    lastLogin: activity?.lastLogin || null,
    lastLogout: activity?.lastLogout || null,
  } });
};

const updateAdmin = async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ message: 'Admin details are required.' });
  const admin = await getOneOr404(User, req.params.id);
  if (admin.role !== 'admin') return res.status(404).json({ message: 'Admin not found.' });

  if (req.body.name !== undefined) {
    if (!String(req.body.name).trim()) return res.status(400).json({ message: 'Admin name is required.' });
    admin.name = String(req.body.name).trim();
  }
  if (req.body.phone !== undefined) {
    if (!String(req.body.phone).trim()) return res.status(400).json({ message: 'Admin phone is required.' });
    admin.phone = String(req.body.phone).trim();
  }
  if (req.body.email !== undefined) {
    const email = String(req.body.email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (await User.exists({ email, _id: { $ne: admin._id } })) return res.status(409).json({ message: 'A user with this email already exists.' });
    admin.email = email;
  }
  await admin.save();
  res.json({ admin: safeAdmin(admin) });
};

const updateAdminPermissions = async (req, res) => {
  const { permissions } = req.body || {};
  const target = await getOneOr404(User, req.params.id);

  if (target.role !== 'admin') {
    return res.status(400).json({ message: 'Only admin accounts can be modified here.' });
  }

  const nextPermissions = Object.fromEntries(ADMIN_SECTION_KEYS.map((section) => [section, section === 'dashboard' || permissions?.[section] === true]));

  target.permissions = nextPermissions;
  await target.save();
  res.json({ user: safeAdmin(target) });
};

const resetAdminPassword = async (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ message: 'Temporary password must be at least 8 characters.' });
  const admin = await getOneOr404(User, req.params.id);
  if (admin.role !== 'admin') return res.status(400).json({ message: 'Only a normal admin password can be reset here.' });
  admin.passwordHash = await bcrypt.hash(password, 12);
  admin.passwordResetTokenHash = undefined;
  admin.passwordResetExpiresAt = undefined;
  await admin.save();
  res.json({ message: 'Admin password reset successfully.' });
};

const updateAdminStatus = async (req, res) => {
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ message: 'Admin status is required.' });
  if (!['active', 'suspended'].includes(req.body.status)) return res.status(400).json({ message: 'Admin status must be active or suspended.' });
  const admin = await getOneOr404(User, req.params.id);
  if (admin.role !== 'admin') return res.status(404).json({ message: 'Admin not found.' });
  await protectAdminAccount(admin, { status: req.body.status }, req.user.userId);
  admin.status = req.body.status;
  admin.isActive = req.body.status === 'active';
  await admin.save();
  res.json({ admin: safeAdmin(admin) });
};

const removeAdmin = async (req, res) => {
  const admin = await getOneOr404(User, req.params.id);
  if (admin.role !== 'admin') return res.status(404).json({ message: 'Admin not found.' });
  await protectAdminAccount(admin, { delete: true }, req.user.userId);
  await User.deleteOne({ _id: admin._id });
  res.json({ message: 'Admin removed.' });
};

const getAdminActivity = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.adminId) {
    requireValidId(req.query.adminId);
    filter.adminId = req.query.adminId;
  }
  if (req.query.section) filter.section = String(req.query.section).trim();
  if (req.query.action) filter.action = String(req.query.action).trim();
  if (req.query.status) {
    validateEnum(req.query.status, ['completed', 'failed'], 'activity status');
    filter.status = req.query.status;
  }
  if (req.query.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) {
      const error = new Error('Invalid activity date.');
      error.statusCode = 400;
      throw error;
    }
    const start = new Date(`${req.query.date}T00:00:00.000Z`);
    if (Number.isNaN(start.valueOf())) {
      const error = new Error('Invalid activity date.');
      error.statusCode = 400;
      throw error;
    }
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    filter.timestamp = { $gte: start, $lt: end };
  }
  const [activities, total] = await Promise.all([
    AdminActivity.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    AdminActivity.countDocuments(filter),
  ]);
  res.json(paginationResponse(activities, page, limit, total));
};

const getMyAdminActivity = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const sectionPermissions = {
    'Chamber Membership': 'chamberMembership',
    'Chamber Membership Approval': 'chamberApprovals',
    'Chamber Member Documents': 'chamberDocuments',
    'QR Codes': 'qrCodes',
    Jobs: 'jobs',
    'Job Approvals': 'jobApprovals',
    'Job Applications': 'jobApplications',
    'Business Listings': 'businesses',
    'Business Approvals': 'businessApprovals',
    News: 'news',
    Advertisements: 'advertisements',
    Offers: 'offers',
    Users: 'users',
    Reports: 'reports',
  };
  const allowedSections = Object.entries(sectionPermissions)
    .filter(([, permission]) => req.user.role === 'super_admin' || req.user.permissions?.[permission])
    .map(([section]) => section);
  const filter = {
    adminId: req.user.userId,
    $or: [{ section: 'Authentication' }, { section: { $in: allowedSections } }],
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [activities, total, completedToday] = await Promise.all([
    AdminActivity.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    AdminActivity.countDocuments(filter),
    AdminActivity.countDocuments({ ...filter, timestamp: { $gte: today }, status: 'completed', action: { $nin: ['LOGIN', 'LOGOUT'], $not: /^Viewed / } }),
  ]);
  res.json({ ...paginationResponse(activities, page, limit, total), completedToday });
};

const getAdminWorkOverview = async (req, res) => {
  const admins = await User.find({ role: 'admin' }).select('_id name email status isActive permissions').lean();
  const activitySummaries = await getAdminActivitySummaries(admins.map((admin) => admin._id));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const summaries = await Promise.all(admins.map(async (admin) => {
    const [activities, completedToday, pending] = await Promise.all([
      AdminActivity.find({ adminId: admin._id }).sort({ timestamp: -1 }).limit(1).lean(),
      AdminActivity.countDocuments({ adminId: admin._id, timestamp: { $gte: today }, status: 'completed', action: { $nin: ['LOGIN', 'LOGOUT'], $not: /^Viewed / } }),
      Promise.all([
        admin.permissions?.chamberApprovals ? ChamberMembership.countDocuments({ status: 'pending' }) : 0,
        admin.permissions?.jobApprovals ? Job.countDocuments({ status: 'pending' }) : 0,
        admin.permissions?.businessApprovals ? Business.countDocuments({ status: 'pending' }) : 0,
      ]).then((counts) => counts.reduce((sum, count) => sum + count, 0)),
    ]);
    const lastActivity = activities[0] || null;
    const elapsed = lastActivity ? Date.now() - new Date(lastActivity.timestamp).getTime() : Infinity;
    const activityStatus = admin.status !== 'active' || admin.isActive === false || !lastActivity || lastActivity.action === 'LOGOUT'
      ? 'Offline'
      : elapsed <= 15 * 60 * 1000 ? 'Active' : 'Idle';
    return {
      ...safeAdmin(admin),
      assignedSections: ADMIN_SECTION_KEYS.filter((section) => admin.permissions?.[section]),
      pending,
      completedToday,
      lastActivity,
      lastLogin: activitySummaries.get(String(admin._id))?.lastLogin || null,
      lastLogout: activitySummaries.get(String(admin._id))?.lastLogout || null,
      activityStatus,
    };
  }));
  const superAdmin = await User.findOne({ role: 'super_admin' }).select('_id status isActive').lean();
  res.json({
    totalAdmins: admins.length + (superAdmin ? 1 : 0),
    activeAdmins: admins.filter((admin) => admin.status === 'active' && admin.isActive !== false).length + (superAdmin?.status === 'active' && superAdmin.isActive !== false ? 1 : 0),
    inactiveAdmins: admins.filter((admin) => admin.status !== 'active' || admin.isActive === false).length + (superAdmin && (superAdmin.status !== 'active' || superAdmin.isActive === false) ? 1 : 0),
    activitiesToday: await AdminActivity.countDocuments({ timestamp: { $gte: today } }),
    admins: summaries,
  });
};

const getReports = async (req, res) => {
  const [users, businesses, jobs, applications, memberships, qrCodes, admins, activitiesToday] = await Promise.all([
    User.countDocuments({ role: { $nin: ['admin', 'super_admin'] } }),
    Business.countDocuments(),
    Job.countDocuments(),
    JobApplication.countDocuments(),
    ChamberMembership.countDocuments(),
    QrCode.countDocuments({ status: 'active' }),
    User.countDocuments({ role: { $in: ['admin', 'super_admin'] } }),
    AdminActivity.countDocuments({ timestamp: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
  ]);
  res.json({ users, businesses, jobs, applications, memberships, qrCodes, admins, activitiesToday });
};

const getSystemSettings = async (req, res) => {
  res.json({
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    uptimeSeconds: Math.floor(process.uptime()),
  });
};

const getUsers = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { role: { $nin: ['admin', 'super_admin'] } };
  if (req.query.role) validateEnum(req.query.role, USER_ROLES, 'role');
  if (req.query.status) validateEnum(req.query.status, USER_STATUSES, 'status');
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.status = req.query.status;
  Object.assign(filter, searchFilter(req.query.search, ['name', 'email', 'phone']));
  const [users, total] = await Promise.all([
    User.find(filter).select('_id name email phone role status createdAt updatedAt').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json(paginationResponse(users.map(safeUser), page, limit, total));
};

const getUser = async (req, res) => {
  const user = await getOneOr404(User, req.params.id);
  if (['admin', 'super_admin'].includes(user.role)) return res.status(404).json({ message: 'User not found.' });
  res.json({ user: safeUser(user) });
};

const updateUserStatus = async (req, res) => {
  const { status } = req.body;
  validateEnum(status, USER_STATUSES, 'status');
  const user = await getOneOr404(User, req.params.id);
  await protectAdminAccount(user, { status }, req.user.userId);
  user.status = status;
  await user.save();
  res.json({ user: safeUser(user) });
};

const updateUserRole = async (req, res) => {
  const { role } = req.body;
  validateEnum(role, USER_ROLES, 'role');
  const user = await getOneOr404(User, req.params.id);
  await protectAdminAccount(user, { role }, req.user.userId);
  user.role = role;
  await user.save();
  res.json({ user: safeUser(user) });
};

const deleteUser = async (req, res) => {
  const user = await getOneOr404(User, req.params.id);
  await protectAdminAccount(user, { delete: true }, req.user.userId);
  await User.deleteOne({ _id: user._id });
  res.json({ message: 'User deleted.' });
};

const getDashboard = async (req, res) => {
  await expireElapsedMemberships();
  if (req.user.role !== 'super_admin') {
    const permissions = req.user.permissions || {};
    const [users, businesses, jobs, applications, chamberMemberships, qrCodes] = await Promise.all([
      permissions.users ? Promise.all([
        User.countDocuments({ role: { $nin: ['admin', 'super_admin'] } }),
        User.countDocuments({ role: { $nin: ['admin', 'super_admin'] }, status: 'pending' }),
        User.countDocuments({ role: { $nin: ['admin', 'super_admin'] }, status: 'active' }),
      ]) : null,
      permissions.businesses || permissions.businessApprovals ? Promise.all([
        Business.countDocuments(),
        permissions.businessApprovals ? Business.countDocuments({ status: 'pending' }) : 0,
        Business.countDocuments({ status: 'approved' }),
        Business.countDocuments({ status: 'rejected' }),
      ]) : null,
      permissions.jobs || permissions.jobApprovals ? Promise.all([
        Job.countDocuments(),
        permissions.jobApprovals ? Job.countDocuments({ status: 'pending' }) : 0,
        Job.countDocuments({ status: 'published' }),
        Job.countDocuments({ status: 'rejected' }),
        Job.countDocuments({ status: 'closed' }),
      ]) : null,
      permissions.jobApplications ? Promise.all([
        JobApplication.countDocuments(),
        JobApplication.countDocuments({ status: 'eligible' }),
        JobApplication.countDocuments({ status: 'not_eligible' }),
        JobApplication.countDocuments({ status: 'shortlisted' }),
      ]) : null,
      permissions.chamberMembership || permissions.chamberApprovals || permissions.qrCodes ? Promise.all([
        ChamberMembership.countDocuments(),
        permissions.chamberApprovals ? ChamberMembership.countDocuments({ status: 'pending' }) : 0,
        ChamberMembership.countDocuments({ status: 'active' }),
        ChamberMembership.countDocuments({ status: 'rejected' }),
        ChamberMembership.countDocuments({ status: 'expired' }),
        permissions.qrCodes ? QrCode.countDocuments({ status: 'active' }) : 0,
      ]) : null,
    ]);
    const scopedStats = {};
    if (users) scopedStats.users = { total: users[0], pending: users[1], active: users[2] };
    if (businesses) scopedStats.businesses = { total: businesses[0], pending: businesses[1], approved: businesses[2], rejected: businesses[3] };
    if (jobs) scopedStats.jobs = { total: jobs[0], pending: jobs[1], published: jobs[2], rejected: jobs[3], closed: jobs[4] };
    if (applications) scopedStats.applications = { total: applications[0], eligible: applications[1], notEligible: applications[2], shortlisted: applications[3] };
    if (chamberMemberships) scopedStats.chamberMemberships = { total: chamberMemberships[0], pending: chamberMemberships[1], active: chamberMemberships[2], rejected: chamberMemberships[3], expired: chamberMemberships[4], activeQrCodes: chamberMemberships[5] };
    return res.json(scopedStats);
  }

  const [totalUsers, jobSeekers, shopOwners, chamberMembers, admins, pendingUsers, activeUsers,
    businessesTotal, businessesPending, businessesApproved, businessesRejected,
    jobsTotal, jobsPending, jobsPublished, jobsRejected, jobsClosed,
    applicationsTotal, applicationsEligible, applicationsNotEligible, applicationsShortlisted,
    membershipsTotal, membershipsPending, membershipsActive, membershipsRejected, membershipsExpired, membershipsSuspended, activeQrCodes] = await Promise.all([
    User.countDocuments(), User.countDocuments({ role: 'job_seeker' }), User.countDocuments({ role: 'shop_owner' }),
    User.countDocuments({ role: 'chamber_member' }), User.countDocuments({ role: { $in: ['admin', 'super_admin'] } }), User.countDocuments({ status: 'pending' }), User.countDocuments({ status: 'active' }),
    Business.countDocuments(), Business.countDocuments({ status: 'pending' }), Business.countDocuments({ status: 'approved' }), Business.countDocuments({ status: 'rejected' }),
    Job.countDocuments(), Job.countDocuments({ status: 'pending' }), Job.countDocuments({ status: 'published' }), Job.countDocuments({ status: 'rejected' }), Job.countDocuments({ status: 'closed' }),
    JobApplication.countDocuments(), JobApplication.countDocuments({ status: 'eligible' }), JobApplication.countDocuments({ status: 'not_eligible' }), JobApplication.countDocuments({ status: 'shortlisted' }),
    ChamberMembership.countDocuments(), ChamberMembership.countDocuments({ status: 'pending' }), ChamberMembership.countDocuments({ status: 'active' }), ChamberMembership.countDocuments({ status: 'rejected' }), ChamberMembership.countDocuments({ status: 'expired' }), ChamberMembership.countDocuments({ status: 'suspended' }), QrCode.countDocuments({ status: 'active' }),
  ]);
  res.json({
    users: { total: totalUsers, jobSeekers, shopOwners, chamberMembers, admins, pending: pendingUsers, active: activeUsers },
    businesses: { total: businessesTotal, pending: businessesPending, approved: businessesApproved, rejected: businessesRejected },
    jobs: { total: jobsTotal, pending: jobsPending, published: jobsPublished, rejected: jobsRejected, closed: jobsClosed },
    applications: { total: applicationsTotal, eligible: applicationsEligible, notEligible: applicationsNotEligible, shortlisted: applicationsShortlisted },
    chamberMemberships: { total: membershipsTotal, pending: membershipsPending, active: membershipsActive, rejected: membershipsRejected, expired: membershipsExpired, suspended: membershipsSuspended, activeQrCodes },
  });
};

const listResource = async (Model, req, res, options = {}) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { ...(options.filter || {}) };
  if (req.query.status && options.statuses) validateEnum(req.query.status, options.statuses, 'status');
  if (req.query.status) filter.status = req.query.status;
  Object.assign(filter, searchFilter(req.query.search, options.searchFields || []));
  if (options.extraFilter) options.extraFilter(req, filter);
  const query = Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
  (options.populate || []).forEach((path) => { query.populate(path); });
  const [data, total] = await Promise.all([query, Model.countDocuments(filter)]);
  res.json(paginationResponse(data, page, limit, total));
};

const getBusinesses = async (req, res) => listResource(Business, req, res, {
  statuses: BUSINESS_STATUSES, searchFields: ['name', 'ownerName', 'category', 'phone', 'email'],
  extraFilter: (request, filter) => { if (request.query.category) filter.category = request.query.category; },
});
const getBusiness = async (req, res) => res.json({ business: await getOneOr404(Business, req.params.id, ['owner']) });
const updateBusinessStatus = async (req, res) => {
  validateEnum(req.body.status, BUSINESS_STATUSES, 'status');
  const business = await getOneOr404(Business, req.params.id);
  business.status = req.body.status;
  business.rejectionReason = req.body.status === 'rejected' ? String(req.body.rejectionReason || '').trim() : '';
  await business.save();
  res.json({ business });
};
const deleteBusiness = async (req, res) => { const business = await getOneOr404(Business, req.params.id); await Business.deleteOne({ _id: business._id }); res.json({ message: 'Business deleted.' }); };

const getChamberMembers = async (req, res) => {
  await expireElapsedMemberships();
  return listResource(ChamberMembership, req, res, {
    statuses: MEMBERSHIP_STATUSES,
    searchFields: ['businessName', 'ownerName', 'email', 'phone', 'category', 'membershipNumber'],
    populate: ['user', 'business'],
  });
};
const getChamberMember = async (req, res) => {
  await expireElapsedMemberships();
  res.json({ membership: await getOneOr404(ChamberMembership, req.params.id, ['user', 'business']) });
};
const updateChamberMemberStatus = async (req, res) => {
  await expireElapsedMemberships();
  validateEnum(req.body.status, MEMBERSHIP_STATUSES, 'status');
  const membership = await getOneOr404(ChamberMembership, req.params.id);
  membership.status = req.body.status;
  membership.rejectionReason = req.body.status === 'rejected' ? String(req.body.rejectionReason || '').trim() : '';
  if (req.body.status === 'active') {
    if (!membership.membershipExpiryDate || membership.membershipExpiryDate < new Date()) {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      membership.membershipStartDate = new Date();
      membership.membershipExpiryDate = expiresAt;
      membership.expiresAt = expiresAt;
      membership.renewalDate = expiresAt;
    }
    await issueMembershipNumber(membership);
    await provisionMembershipQr(membership);
    await User.updateOne({ _id: membership.user }, { $set: { role: 'chamber_member', status: 'active' } });
    await Notification.create({ type: 'membership_approved', message: 'Your Chamber Membership has been approved.', recipient: membership.user, entityType: 'ChamberMembership', entityId: membership._id }).catch((error) => { if (error.code !== 11000) throw error; });
  } else {
    membership.qrStatus = 'disabled';
    await QrCode.updateMany({ membership: membership._id }, { $set: { status: 'disabled' } });
    const notificationMessage = {
      rejected: 'Your Chamber Membership application has been rejected.',
      suspended: 'Your Chamber Membership has been suspended.',
      expired: 'Your Chamber Membership has expired.',
    }[req.body.status];
    if (notificationMessage) await Notification.create({ type: `membership_${req.body.status}`, message: notificationMessage, recipient: membership.user, entityType: 'ChamberMembership', entityId: membership._id }).catch((error) => { if (error.code !== 11000) throw error; });
  }
  await membership.save();
  res.json({ membership });
};
const approveChamberMember = async (req, res) => { req.body.status = 'active'; return updateChamberMemberStatus(req, res); };
const rejectChamberMember = async (req, res) => { req.body.status = 'rejected'; return updateChamberMemberStatus(req, res); };
const deleteChamberMember = async (req, res) => { const membership = await getOneOr404(ChamberMembership, req.params.id); await QrCode.deleteOne({ membership: membership._id }); await ChamberMembership.deleteOne({ _id: membership._id }); res.json({ message: 'Chamber membership deleted.' }); };

// Returns all active QR codes with membership details — used in admin QR overview panel
const getAllMembersQr = async (req, res) => {
  await expireElapsedMemberships();
  const memberships = await ChamberMembership.find({ status: 'active' })
    .select('businessName ownerName category phone email address membershipNumber membershipExpiryDate plan status')
    .sort({ businessName: 1 })
    .lean();
  const qrCodes = await QrCode.find({ membership: { $in: memberships.map((membership) => membership._id) } }).lean();
  const qrByMembership = new Map(qrCodes.map((qr) => [String(qr.membership), qr]));
  const data = await Promise.all(memberships.map(async (membership) => {
    const qr = qrByMembership.get(String(membership._id));
    const publicId = qr?.publicId || qr?.code || '';
    const qrValue = qr?.qrValue || (publicId ? buildPublicUrl(publicId) : '');
    return {
      _id: qr?._id || null,
      membershipId: membership._id,
      publicId,
      qrValue,
      imageDataUrl: qr?.status === 'active' && qrValue
        ? await QRCode.toDataURL(qrValue, { width: 300, margin: 1, errorCorrectionLevel: 'M' })
        : null,
      membershipNumber: membership.membershipNumber,
      status: qr?.status || 'missing',
      membership,
    };
  }));
  res.json({ data });
};

const regenerateMemberQr = async (req, res) => {
  await expireElapsedMemberships();
  const membership = await getOneOr404(ChamberMembership, req.params.id);
  if (membership.status !== 'active') {
    return res.status(400).json({ message: 'Only active Chamber Members can have an active QR code.' });
  }
  await issueMembershipNumber(membership);
  const publicId = crypto.randomUUID().replace(/-/g, '');
  let qr = await QrCode.findOne({ membership: membership._id });
  if (!qr) qr = new QrCode({ membership: membership._id });
  qr.publicId = publicId;
  qr.code = publicId;
  qr.membershipNumber = membership.membershipNumber;
  qr.qrValue = buildPublicUrl(publicId);
  qr.status = 'active';
  await qr.save();
  membership.qrCode = publicId;
  membership.qrStatus = 'active';
  await membership.save();
  const imageDataUrl = await QRCode.toDataURL(qr.qrValue, { width: 300, margin: 1, errorCorrectionLevel: 'M' });
  res.json({
    qrCode: {
      _id: qr._id,
      membershipId: membership._id,
      publicId,
      qrValue: qr.qrValue,
      imageDataUrl,
      membershipNumber: membership.membershipNumber,
      status: qr.status,
      membership: {
        _id: membership._id,
        businessName: membership.businessName,
        ownerName: membership.ownerName,
        membershipExpiryDate: membership.membershipExpiryDate,
      },
    },
  });
};

const getQrCodes = async (req, res) => listResource(QrCode, req, res, { statuses: QR_STATUSES, searchFields: ['code'], populate: ['membership'] });
const getQrCode = async (req, res) => res.json({ qrCode: await getOneOr404(QrCode, req.params.id, ['membership']) });
const updateQrCodeStatus = async (req, res) => {
  validateEnum(req.body.status, QR_STATUSES, 'status');
  const qrCode = await getOneOr404(QrCode, req.params.id);
  qrCode.status = req.body.status;
  await qrCode.save();
  await ChamberMembership.updateOne({ _id: qrCode.membership }, { qrStatus: req.body.status === 'active' ? 'active' : 'disabled' });
  res.json({ qrCode });
};

const getJobs = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) validateEnum(req.query.status, JOB_STATUSES, 'status');
  if (req.query.status) filter.status = req.query.status;
  Object.assign(filter, searchFilter(req.query.search, ['title', 'company', 'description', 'location', 'category']));
  if (req.query.location) filter.location = new RegExp(req.query.location.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (req.query.category) filter.category = req.query.category;
  const [jobs, total] = await Promise.all([
    Job.find(filter).populate('owner', 'name email').populate('business', 'name businessName').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Job.countDocuments(filter),
  ]);
  const data = await Promise.all(jobs.map(async (job) => ({ ...job.toObject(), applicationCount: await JobApplication.countDocuments({ job: job._id }) })));
  res.json(paginationResponse(data, page, limit, total));
};
const getJob = async (req, res) => res.json({ job: await getOneOr404(Job, req.params.id, ['owner', 'business']) });
const updateJobStatus = async (req, res) => {
  validateEnum(req.body.status, JOB_STATUSES, 'status');
  const job = await getOneOr404(Job, req.params.id);
  const rejectionReason = String(req.body.rejectionReason || '').trim();
  if (req.body.status === 'rejected' && !rejectionReason) {
    const error = new Error('A rejection reason is required.');
    error.statusCode = 400;
    throw error;
  }
  const previousStatus = job.status;
  const validTransition = (job.status === 'pending' && ['published', 'rejected'].includes(req.body.status))
    || (job.status === 'published' && req.body.status === 'closed')
    || job.status === req.body.status;
  if (!validTransition) return res.status(400).json({ message: `Cannot change a ${job.status} job to ${req.body.status}.` });
  job.status = req.body.status;
  job.rejectionReason = req.body.status === 'rejected' ? rejectionReason : '';
  job.publishedAt = req.body.status === 'published' ? (job.publishedAt || new Date()) : job.publishedAt;
  await job.save();
  const owner = await User.findById(job.owner).select('_id');
  if (owner && previousStatus !== req.body.status && ['published', 'rejected'].includes(req.body.status)) {
    await Notification.create({
      type: 'job_status_changed',
      message: req.body.status === 'published'
        ? `Your job "${job.title}" has been approved and published.`
        : `Your job "${job.title}" was rejected: ${job.rejectionReason}`,
      recipient: owner._id,
      entityType: 'Job',
      entityId: job._id,
    });
  }
  res.json({ job });
};
const deleteJob = async (req, res) => { const job = await getOneOr404(Job, req.params.id); await Job.deleteOne({ _id: job._id }); res.json({ message: 'Job deleted.' }); };

const applicationPopulate = [
  { path: 'jobSeeker', select: 'name email phone location education experience skills cv role status' },
  { path: 'job', select: 'title company requirements location status business' },
];
const getApplications = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) validateEnum(req.query.status, APPLICATION_STATUSES, 'status');
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search?.trim()) {
    const expression = new RegExp(req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const [users, jobs] = await Promise.all([
      User.find({ $or: [{ name: expression }, { email: expression }] }).select('_id'),
      Job.find({ $or: [{ title: expression }, { company: expression }] }).select('_id'),
    ]);
    filter.$or = [{ jobSeeker: { $in: users.map((user) => user._id) } }, { job: { $in: jobs.map((job) => job._id) } }];
  }
  const [data, total] = await Promise.all([
    JobApplication.find(filter).populate(applicationPopulate).sort({ createdAt: -1 }).skip(skip).limit(limit),
    JobApplication.countDocuments(filter),
  ]);
  res.json(paginationResponse(data, page, limit, total));
};
const getApplication = async (req, res) => res.json({ application: await getOneOr404(JobApplication, req.params.id, applicationPopulate) });
const updateApplicationStatus = async (req, res) => {
  validateEnum(req.body.status, APPLICATION_STATUSES, 'status');
  const application = await getOneOr404(JobApplication, req.params.id, [{ path: 'job', select: 'title' }]);
  application.status = req.body.status;
  await application.save();
  const labels = { submitted: 'Submitted', eligible: 'Eligible', not_eligible: 'Not Eligible', shortlisted: 'Shortlisted', rejected: 'Rejected' };
  await Notification.create({
    type: `application_status_${req.body.status}`,
    message: req.body.status === 'shortlisted'
      ? `Congratulations! You have been shortlisted for the ${application.job.title} position.`
      : `Your application for ${application.job.title} has been marked as ${labels[req.body.status]}.`,
    recipient: application.jobSeeker,
    entityType: 'JobApplication',
    entityId: application._id,
  });
  res.json({ application });
};
const getApplicationCandidate = async (req, res) => {
  const application = await getOneOr404(JobApplication, req.params.id, applicationPopulate);
  res.json({
    candidate: { name: application.jobSeeker?.name, email: application.jobSeeker?.email, phone: application.jobSeeker?.phone, location: application.jobSeeker?.location, education: application.education, experience: application.experience, skills: application.skills, cv: application.jobSeeker?.cv ? { fileName: application.jobSeeker.cv.fileName, fileType: application.jobSeeker.cv.fileType, fileSize: application.jobSeeker.cv.fileSize } : null },
    job: { title: application.job?.title, company: application.job?.company, requirements: application.job?.requirements },
    application: { status: application.status, createdAt: application.createdAt },
  });
};
const getApplicationCv = async (req, res) => {
  const application = await getOneOr404(JobApplication, req.params.id);
  const user = await User.findById(application.jobSeeker).select('cv');
  if (!user?.cv?.file) return res.status(404).json({ message: 'CV not found.' });
  res.json({ cv: user.cv });
};

const slugify = (value) => String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const uniqueSlug = async (title, requested, currentId) => {
  const base = slugify(requested || title);
  if (!base) { const error = new Error('A valid title or slug is required.'); error.statusCode = 400; throw error; }
  let slug = base; let suffix = 2;
  while (await News.exists({ slug, ...(currentId ? { _id: { $ne: currentId } } : {}) })) slug = `${base}-${suffix++}`;
  return slug;
};
const getNews = async (req, res) => listResource(News, req, res, { statuses: NEWS_STATUSES, searchFields: ['title', 'description', 'summary', 'content', 'category'], populate: [{ path: 'author', select: 'name' }] });
const getNewsItem = async (req, res) => res.json({ news: await getOneOr404(News, req.params.id, [{ path: 'author', select: 'name' }]) });
const createNews = async (req, res) => {
  const { title, description, summary, content, image, category, author, status = 'draft', publishedAt } = req.body;
  if (!title || !content) { const error = new Error('title and content are required.'); error.statusCode = 400; throw error; }
  validateEnum(status, NEWS_STATUSES, 'status');
  const news = await News.create({ title, slug: await uniqueSlug(title, req.body.slug), description: description || summary, summary: summary || description, content, image, category, author: author || req.user.userId, status, publishedAt: status === 'published' ? (publishedAt || new Date()) : undefined });
  res.status(201).json({ news });
};
const updateNews = async (req, res) => {
  const news = await getOneOr404(News, req.params.id);
  const allowed = ['title', 'description', 'summary', 'content', 'image', 'category', 'author', 'status', 'publishedAt'];
  Object.keys(req.body).forEach((key) => { if (allowed.includes(key)) news[key] = req.body[key]; });
  if (req.body.title || req.body.slug) news.slug = await uniqueSlug(req.body.title || news.title, req.body.slug || news.slug, news._id);
  if (req.body.description) news.summary = req.body.description;
  if (req.body.summary) news.description = req.body.summary;
  if (req.body.status) validateEnum(req.body.status, NEWS_STATUSES, 'status');
  if (news.status === 'published' && !news.publishedAt) news.publishedAt = new Date();
  if (news.status !== 'published') news.publishedAt = undefined;
  await news.save();
  res.json({ news });
};
const updateNewsStatus = async (req, res) => {
  validateEnum(req.body.status, NEWS_STATUSES, 'status');
  const news = await getOneOr404(News, req.params.id);
  news.status = req.body.status;
  news.publishedAt = req.body.status === 'published' ? (news.publishedAt || new Date()) : undefined;
  await news.save();
  res.json({ news });
};
const deleteNews = async (req, res) => { const news = await getOneOr404(News, req.params.id); await News.deleteOne({ _id: news._id }); res.json({ message: 'News item deleted.' }); };

const applyKolkataSchedule = (body, fields) => {
  fields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(body, field) || body[field] == null || body[field] === '') {
      if (Object.prototype.hasOwnProperty.call(body, field)) body[field] = null;
      return;
    }
    body[field] = parseKolkataDate(body[field]);
  });
};
const validateCommunityUpdate = ({ category, text, status, startAt, endAt }) => {
  if (!String(category || '').trim() || !String(text || '').trim()) {
    const error = new Error('category and text are required.');
    error.statusCode = 400;
    throw error;
  }
  if (status) validateEnum(status, COMMUNITY_UPDATE_STATUSES, 'status');
  for (const [field, value] of [['startAt', startAt], ['endAt', endAt]]) {
    if (value && Number.isNaN(new Date(value).valueOf())) {
      const error = new Error(`Invalid ${field} date.`);
      error.statusCode = 400;
      throw error;
    }
  }
  if (startAt && endAt && new Date(endAt) < new Date(startAt)) {
    const error = new Error('endAt must be after startAt.');
    error.statusCode = 400;
    throw error;
  }
};
const getCommunityUpdates = async (req, res) => listResource(CommunityUpdate, req, res, {
  statuses: COMMUNITY_UPDATE_STATUSES,
  searchFields: ['text', 'icon'],
});
const createCommunityUpdate = async (req, res) => {
  const body = {
    category: req.body.category,
    text: req.body.text,
    icon: req.body.icon,
    status: req.body.status || 'active',
    startAt: req.body.startAt || undefined,
    endAt: req.body.endAt || undefined,
  };
  applyKolkataSchedule(body, ['startAt', 'endAt']);
  validateCommunityUpdate(body);
  const communityUpdate = await CommunityUpdate.create(body);
  res.status(201).json({ communityUpdate });
};
const updateCommunityUpdate = async (req, res) => {
  const communityUpdate = await getOneOr404(CommunityUpdate, req.params.id);
  const body = {
    category: req.body.category === undefined ? communityUpdate.category : req.body.category,
    text: req.body.text === undefined ? communityUpdate.text : req.body.text,
    icon: req.body.icon === undefined ? communityUpdate.icon : req.body.icon,
    status: req.body.status === undefined ? communityUpdate.status : req.body.status,
    startAt: req.body.startAt === undefined ? communityUpdate.startAt : (req.body.startAt || null),
    endAt: req.body.endAt === undefined ? communityUpdate.endAt : (req.body.endAt || null),
  };
  if (req.body.startAt !== undefined || req.body.endAt !== undefined) applyKolkataSchedule(body, ['startAt', 'endAt']);
  validateCommunityUpdate(body);
  communityUpdate.set(body);
  await communityUpdate.save();
  res.json({ communityUpdate });
};
const updateCommunityUpdateStatus = async (req, res) => {
  validateEnum(req.body.status, COMMUNITY_UPDATE_STATUSES, 'status');
  const communityUpdate = await getOneOr404(CommunityUpdate, req.params.id);
  communityUpdate.status = req.body.status;
  await communityUpdate.save();
  res.json({ communityUpdate });
};
const deleteCommunityUpdate = async (req, res) => {
  const communityUpdate = await getOneOr404(CommunityUpdate, req.params.id);
  await CommunityUpdate.deleteOne({ _id: communityUpdate._id });
  res.json({ message: 'Community update deleted.' });
};

const getOffers = async (req, res) => listResource(Offer, req, res, { statuses: OFFER_STATUSES, searchFields: ['title', 'description', 'category'], populate: ['business'] });
const getOffer = async (req, res) => res.json({ offer: await getOneOr404(Offer, req.params.id, ['business']) });
const normalizeOfferDates = (body) => ({ ...body, endDate: /^\d{4}-\d{2}-\d{2}$/.test(String(body.endDate || '')) ? `${body.endDate}T23:59:59.999Z` : body.endDate });
const validateOfferBody = (body) => { if (!body.title || !body.startDate || !body.endDate) { const error = new Error('title, startDate, and endDate are required.'); error.statusCode = 400; throw error; } if (body.status) validateEnum(body.status, OFFER_STATUSES, 'status'); if (body.startDate && Number.isNaN(new Date(body.startDate).valueOf())) { const error = new Error('Invalid start date.'); error.statusCode = 400; throw error; } if (body.endDate && Number.isNaN(new Date(body.endDate).valueOf())) { const error = new Error('Invalid end date.'); error.statusCode = 400; throw error; } if (new Date(body.endDate) < new Date(body.startDate)) { const error = new Error('endDate must be after startDate.'); error.statusCode = 400; throw error; } };
const createOffer = async (req, res) => { const body = normalizeOfferDates(req.body); validateOfferBody(body); const offer = await Offer.create({ ...body, status: body.status || 'draft' }); res.status(201).json({ offer }); };
const updateOffer = async (req, res) => { const offer = await getOneOr404(Offer, req.params.id); const body = normalizeOfferDates(req.body); validateOfferBody(body); const allowed = ['title', 'description', 'image', 'category', 'business', 'link', 'status', 'startDate', 'endDate']; Object.keys(body).forEach((key) => { if (allowed.includes(key)) offer[key] = body[key]; }); await offer.save(); res.json({ offer }); };
const updateOfferStatus = async (req, res) => {
  validateEnum(req.body.status, OFFER_STATUSES, 'status');
  const offer = await getOneOr404(Offer, req.params.id);
  offer.status = req.body.status;
  await offer.save();
  res.json({ offer });
};
const deleteOffer = async (req, res) => { const offer = await getOneOr404(Offer, req.params.id); await Offer.deleteOne({ _id: offer._id }); res.json({ message: 'Offer deleted.' }); };

const getAds = async (req, res) => { const { page, limit, skip } = getPagination(req.query); const [data, total] = await Promise.all([Ad.find().sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit), Ad.countDocuments()]); res.json(paginationResponse(data, page, limit, total)); };
const sanitizeAdText = (value, maxLength, fieldName) => {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw Object.assign(new Error(`${fieldName} must be text.`), { statusCode: 400 });
  const text = value.replace(/<[^>]*>/g, '').trim();
  if (Array.from(text).length > maxLength) {
    throw Object.assign(new Error(`${fieldName} must be ${maxLength} characters or fewer.`), { statusCode: 400 });
  }
  return text || null;
};
const copyLinkedImageRequested = (body) => {
  if (body.copy_linked_image !== undefined && typeof body.copy_linked_image !== 'boolean') {
    throw Object.assign(new Error('copy_linked_image must be true or false.'), { statusCode: 400 });
  }
  return body.copy_linked_image !== false;
};
const prepareAdImage = async (input) => {
  const body = { ...input };
  body.adTitle = sanitizeAdText(body.adTitle, 60, 'Ad title');
  body.description = sanitizeAdText(body.description, 120, 'Ad description');
  if (body.sideOrder === '' || body.sideOrder == null) {
    body.sideOrder = null;
  } else {
    const sideOrder = Number(body.sideOrder);
    if (!Number.isInteger(sideOrder) || sideOrder < 1 || sideOrder > 3) {
      throw Object.assign(new Error('Position must be 1, 2 or 3.'), { statusCode: 400 });
    }
    body.sideOrder = sideOrder;
  }
  const copyLinkedImage = copyLinkedImageRequested(body);
  delete body.copy_linked_image;
  if (body.image_source && !['upload', 'url'].includes(body.image_source)) {
    throw Object.assign(new Error('image_source must be upload or url.'), { statusCode: 400 });
  }
  if (body.image_source === 'url') {
    if (!body.image_url) throw Object.assign(new Error('Enter an image URL.'), { statusCode: 400 });
    const downloaded = await downloadPublicImage(body.image_url);
    if (copyLinkedImage) {
      try {
        body.imageUrl = await storeDownloadedImage(downloaded);
      } catch (error) {
        console.error('Could not store linked ad image. Using the original URL.', error.message);
        body.imageUrl = body.image_url;
      }
    } else {
      body.imageUrl = body.image_url;
    }
  } else {
    body.image_source = 'upload';
    body.image_url = '';
    if (!body.imageUrl) throw Object.assign(new Error('Upload an ad image before saving.'), { statusCode: 400 });
    body.imageUrl = await persistUploadedImage(body.imageUrl, 'Advertisement image');
  }
  applyKolkataSchedule(body, ['startAt', 'endAt', 'startDate', 'endDate']);
  return body;
};
const createAd = async (req, res) => {
  const body = await prepareAdImage(req.body);
  const ad = await Ad.create({ ...body, status: 'draft', approved: false, approval_status: 'pending' });
  res.status(201).json({ ad });
};
const updateAd = async (req, res) => {
  const ad = await getOneOr404(Ad, req.params.id);
  const body = await prepareAdImage(req.body);
  delete body.approved;
  delete body._id;
  delete body.createdAt;
  delete body.updatedAt;
  delete body.__v;
  Object.assign(ad, body);
  ad.approved = false;
  ad.approval_status = 'pending';
  if (ad.status === 'published') ad.status = 'draft';
  await ad.save();
  res.json({ ad });
};
const updateAdStatus = async (req, res) => {
  validateEnum(req.body.status, ['draft', 'published', 'unpublished'], 'status');
  const ad = await getOneOr404(Ad, req.params.id);
  if (req.body.status === 'published' && !ad.approved) {
    return res.status(400).json({ message: 'An ad must be approved before it can be published.' });
  }
  ad.status = req.body.status;
  if (ad.status === 'unpublished') ad.enabled = false;
  else if (ad.status === 'published') ad.enabled = true;
  await ad.save();
  res.json({ ad });
};
const approveAd = async (req, res) => {
  const ad = await getOneOr404(Ad, req.params.id);
  if ((!ad.imageUrl && !ad.image_url) || !ad.link) {
    return res.status(400).json({ message: 'An advertisement needs an image and destination link before approval.' });
  }
  ad.approved = true;
  ad.approval_status = 'approved';
  ad.status = 'published';
  await ad.save();
  res.json({ ad });
};
const deleteAd = async (req, res) => { const ad = await getOneOr404(Ad, req.params.id); await Ad.deleteOne({ _id: ad._id }); res.json({ message: 'Advertisement deleted.' }); };

const HERO_IMAGE_FIELDS = [
  { upload: 'desktopImage', url: 'image_url', source: 'image_source', required: true },
  { upload: 'wideImage', url: 'wide_image_url', source: 'wide_image_source' },
  { upload: 'mobileImage', url: 'mobile_image_url', source: 'mobile_image_source' },
];
const validateUploadedImage = (value, label) => {
  if (/^\/api\/public\/uploads\/[a-f0-9-]+\.(?:jpg|png|webp|gif)$/i.test(value)) return;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw Object.assign(new Error(`${label} must be an uploaded JPG, PNG or WebP image.`), { statusCode: 400 });
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 2 * 1024 * 1024 || buffer.length === 0 || buffer.toString('base64') !== match[2]) {
    throw Object.assign(new Error(`${label} must be 2 MB or smaller and contain valid image data.`), { statusCode: 400 });
  }
  const validSignature = match[1] === 'image/jpeg'
    ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    : match[1] === 'image/png'
      ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  if (!validSignature) throw Object.assign(new Error(`${label} content does not match its image type.`), { statusCode: 400 });
};
const persistUploadedImage = async (value, label) => {
  if (/^\/api\/public\/uploads\/[a-f0-9-]+\.(?:jpg|png|webp|gif)$/i.test(value)) return value;
  validateUploadedImage(value, label);
  const match = /^data:(image\/(?:jpeg|png|webp));base64,/.exec(value);
  try {
    return await storeDownloadedImage({
      buffer: Buffer.from(value.slice(value.indexOf(',') + 1), 'base64'),
      contentType: match[1],
    });
  } catch (error) {
    console.error(`Could not store ${label} on disk. Keeping the uploaded image inline.`, error.message);
    return value;
  }
};
const sanitizeHeroSlideText = (input) => {
  const body = {};
  ['show_text', 'title', 'description'].forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(input, field)) return;
    if (field === 'show_text') {
      if (typeof input[field] !== 'boolean') throw Object.assign(new Error('show_text must be true or false.'), { statusCode: 400 });
      body[field] = input[field];
      return;
    }
    if (input[field] === null) {
      body[field] = null;
      return;
    }
    if (typeof input[field] !== 'string') throw Object.assign(new Error(`${field === 'title' ? 'Title' : 'Description'} must be text.`), { statusCode: 400 });
    const maxLength = field === 'title' ? 80 : 160;
    const text = input[field].replace(/<[^>]*>/g, '').trim();
    if (Array.from(text).length > maxLength) {
      throw Object.assign(new Error(`${field === 'title' ? 'Title' : 'Description'} must be ${maxLength} characters or fewer.`), { statusCode: 400 });
    }
    body[field] = text || null;
  });
  return body;
};
const prepareHeroSlide = async (input) => {
  const body = { ...input, ...sanitizeHeroSlideText(input) };
  if (body.show_text === undefined) body.show_text = false;
  if (body.title === undefined) body.title = null;
  if (body.description === undefined) body.description = null;
  const copyLinkedImage = copyLinkedImageRequested(body);
  delete body.copy_linked_image;
  for (const field of HERO_IMAGE_FIELDS) {
    const source = body[field.source] || 'upload';
    if (!['upload', 'url'].includes(source)) {
      throw Object.assign(new Error(`${field.source} must be upload or url.`), { statusCode: 400 });
    }
    if (source === 'url') {
      if (!body[field.url]) {
        if (field.required) throw Object.assign(new Error('Enter a desktop image URL.'), { statusCode: 400 });
        body[field.upload] = '';
        continue;
      }
      const downloaded = await downloadPublicImage(body[field.url]);
      if (copyLinkedImage) {
        try {
          body[field.upload] = await storeDownloadedImage(downloaded);
        } catch (error) {
          console.error('Could not store linked hero image. Using the original URL.', error.message);
          body[field.upload] = body[field.url];
        }
      } else {
        body[field.upload] = body[field.url];
      }
      body[field.source] = 'url';
    } else {
      body[field.source] = 'upload';
      body[field.url] = '';
      if (field.required && !body[field.upload]) {
        throw Object.assign(new Error('Upload a desktop image before saving the slide.'), { statusCode: 400 });
      }
      if (body[field.upload]) body[field.upload] = await persistUploadedImage(body[field.upload], field.upload);
    }
  }
  applyKolkataSchedule(body, ['startDate', 'endDate']);
  if (body.startDate && body.endDate && body.endDate < body.startDate) {
    throw Object.assign(new Error('End date must be after the start date.'), { statusCode: 400 });
  }
  return body;
};
const probeLinkedImage = async (req, res) => {
  const input = String(req.body?.url || '').trim();
  if (!input) return res.status(400).json({ message: 'Enter an image URL.' });
  const conversion = convertImageLink(input);
  if (conversion.error) return res.status(400).json({ message: conversion.error });
  const { buffer, contentType } = await downloadPublicImage(conversion.url);
  const dimensions = readImageDimensions(buffer, contentType) || {};
  res.json({
    url: conversion.url,
    converted: conversion.converted === true,
    warning: conversion.warning || '',
    note: conversion.note || '',
    width: dimensions.width || null,
    height: dimensions.height || null,
    previewDataUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
  });
};

const getHeroSlides = async (req, res) => {
  const slides = await HeroSlide.find().sort({ order: 1, createdAt: -1 });
  res.json({ data: slides });
};
const createHeroSlide = async (req, res) => {
  const slide = await HeroSlide.create(await prepareHeroSlide(req.body));
  res.status(201).json({ slide });
};
const updateHeroSlide = async (req, res) => {
  const slide = await getOneOr404(HeroSlide, req.params.id);
  const sanitizedText = sanitizeHeroSlideText(req.body);
  const imageFieldsChanged = HERO_IMAGE_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(req.body, field.upload)
    || Object.prototype.hasOwnProperty.call(req.body, field.url)
    || Object.prototype.hasOwnProperty.call(req.body, field.source))
    || Object.prototype.hasOwnProperty.call(req.body, 'copy_linked_image');
  if (!imageFieldsChanged) {
    Object.assign(slide, req.body, sanitizedText);
    await slide.save();
    return res.json({ slide });
  }
  const body = await prepareHeroSlide({ ...slide.toObject(), ...req.body });
  delete body._id;
  delete body.createdAt;
  delete body.updatedAt;
  delete body.__v;
  Object.assign(slide, body);
  await slide.save();
  res.json({ slide });
};
const reorderHeroSlides = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some((id) => !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ message: 'A valid ordered list of slide IDs is required.' });
  }
  await Promise.all(ids.map((id, order) => HeroSlide.updateOne({ _id: id }, { $set: { order } })));
  res.json({ message: 'Hero slides reordered.' });
};
const deleteHeroSlide = async (req, res) => {
  const slide = await getOneOr404(HeroSlide, req.params.id);
  await HeroSlide.deleteOne({ _id: slide._id });
  res.json({ message: 'Hero slide deleted.' });
};

const getNotifications = async (req, res) => listResource(Notification, req, res, { filter: { recipient: req.user.userId }, statuses: [], searchFields: ['type', 'message'] });
const markNotificationRead = async (req, res) => { const notification = await getOneOr404(Notification, req.params.id); if (notification.recipient?.toString() !== req.user.userId) return res.status(403).json({ message: 'You do not own this notification.' }); notification.readAt = new Date(); await notification.save(); res.json({ notification }); };
const markAllNotificationsRead = async (req, res) => { const result = await Notification.updateMany({ recipient: req.user.userId, readAt: null }, { readAt: new Date() }); res.json({ modifiedCount: result.modifiedCount }); };

module.exports = {
  getAdminAccounts, getAdminAccount, createAdmin, updateAdmin, updateAdminPermissions, resetAdminPassword, updateAdminStatus, removeAdmin,
  getAdminActivity, getMyAdminActivity, getAdminWorkOverview, getReports, getSystemSettings,
  getUsers, getUser, updateUserStatus, updateUserRole, deleteUser,
  getDashboard,
  getBusinesses, getBusiness, updateBusinessStatus, deleteBusiness,
  getChamberMembers, getChamberMember, updateChamberMemberStatus, approveChamberMember, rejectChamberMember, deleteChamberMember,
  getAllMembersQr, regenerateMemberQr, getQrCodes, getQrCode, updateQrCodeStatus,
  getJobs, getJob, updateJobStatus, deleteJob,
  getApplications, getApplication, updateApplicationStatus, getApplicationCandidate, getApplicationCv,
  getNews, getNewsItem, createNews, updateNews, updateNewsStatus, deleteNews,
  getCommunityUpdates, createCommunityUpdate, updateCommunityUpdate, updateCommunityUpdateStatus, deleteCommunityUpdate,
  getOffers, getOffer, createOffer, updateOffer, updateOfferStatus, deleteOffer,
  getAds, createAd, updateAd, updateAdStatus, approveAd, deleteAd,
  probeLinkedImage,
  getHeroSlides, createHeroSlide, updateHeroSlide, reorderHeroSlides, deleteHeroSlide,
  getNotifications, markNotificationRead, markAllNotificationsRead,
};
