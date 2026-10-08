const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin, requireSuperAdmin, requireAdminSection, requireAnyAdminSection } = require('../middleware/admin');
const controller = require('../controllers/adminController');
const { auditAdminAction } = require('../services/adminActivity');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const requireMemberStatusPermission = (req, res, next) => requireAdminSection(
	['active', 'rejected'].includes(req.body.status) ? 'chamberApprovals' : 'chamberMembership',
)(req, res, next);
const requireJobStatusPermission = (req, res, next) => requireAdminSection(
	['published', 'rejected'].includes(req.body.status) ? 'jobApprovals' : 'jobs',
)(req, res, next);

router.use(verifyToken, requireAdmin, auditAdminAction);

router.use('/dashboard', requireAdminSection('dashboard'));
router.use('/reports', requireAdminSection('reports'));
router.use('/users', requireAdminSection('users'));
router.use('/all-members-qr', requireAdminSection('qrCodes'));
router.use('/qr-codes', requireAdminSection('qrCodes'));
router.use('/applications', requireAdminSection('jobApplications'));
router.use('/news', requireAdminSection('news'));
router.use('/community-updates', requireAdminSection('news'));
router.use('/offers', requireAdminSection('offers'));
router.use('/ads', requireAdminSection('advertisements'));
router.use('/hero-slides', requireAdminSection('advertisements'));
router.use('/image-links', requireAdminSection('advertisements'));
router.use('/notifications', requireAdminSection('dashboard'));
router.use('/admins', requireSuperAdmin);
router.use('/admin-activity', requireSuperAdmin);
router.use('/admin-work', requireSuperAdmin);
router.use('/system-settings', requireSuperAdmin);

router.get('/health', (req, res) => res.json({ message: 'Admin authorization verified.' }));
router.get('/dashboard', asyncHandler(controller.getDashboard));
router.get('/reports', asyncHandler(controller.getReports));
router.get('/system-settings', asyncHandler(controller.getSystemSettings));

router.get('/admins', asyncHandler(controller.getAdminAccounts));
router.post('/admins', asyncHandler(controller.createAdmin));
router.get('/admins/:id', asyncHandler(controller.getAdminAccount));
router.patch('/admins/:id', asyncHandler(controller.updateAdmin));
router.patch('/admins/:id/status', asyncHandler(controller.updateAdminStatus));
router.patch('/admins/:id/permissions', asyncHandler(controller.updateAdminPermissions));
router.patch('/admins/:id/password', asyncHandler(controller.resetAdminPassword));
router.delete('/admins/:id', asyncHandler(controller.removeAdmin));
router.get('/admin-activity', asyncHandler(controller.getAdminActivity));
router.get('/admin-work', asyncHandler(controller.getAdminWorkOverview));
router.get('/my-activity', asyncHandler(controller.getMyAdminActivity));

router.get('/users', asyncHandler(controller.getUsers));
router.get('/users/:id', asyncHandler(controller.getUser));
router.patch('/users/:id/status', asyncHandler(controller.updateUserStatus));
router.patch('/users/:id/role', asyncHandler(controller.updateUserRole));
router.delete('/users/:id', asyncHandler(controller.deleteUser));

router.get('/businesses', requireAnyAdminSection('businesses', 'businessApprovals'), asyncHandler(controller.getBusinesses));
router.get('/businesses/:id', requireAnyAdminSection('businesses', 'businessApprovals'), asyncHandler(controller.getBusiness));
router.patch('/businesses/:id/status', requireAdminSection('businessApprovals'), asyncHandler(controller.updateBusinessStatus));
router.delete('/businesses/:id', requireAdminSection('businesses'), asyncHandler(controller.deleteBusiness));

router.get('/chamber-members', requireAnyAdminSection('chamberMembership', 'chamberApprovals'), asyncHandler(controller.getChamberMembers));
router.get('/chamber-members/:id', requireAnyAdminSection('chamberMembership', 'chamberApprovals'), asyncHandler(controller.getChamberMember));
router.patch('/chamber-members/:id/status', requireMemberStatusPermission, asyncHandler(controller.updateChamberMemberStatus));
router.patch('/chamber-members/:id/approve', requireAdminSection('chamberApprovals'), asyncHandler(controller.approveChamberMember));
router.patch('/chamber-members/:id/reject', requireAdminSection('chamberApprovals'), asyncHandler(controller.rejectChamberMember));
router.post('/chamber-members/:id/qr/regenerate', requireAdminSection('qrCodes'), asyncHandler(controller.regenerateMemberQr));
router.delete('/chamber-members/:id', requireAdminSection('chamberMembership'), asyncHandler(controller.deleteChamberMember));

router.get('/all-members-qr', asyncHandler(controller.getAllMembersQr));
router.get('/qr-codes', asyncHandler(controller.getQrCodes));
router.get('/qr-codes/:id', asyncHandler(controller.getQrCode));
router.patch('/qr-codes/:id/status', asyncHandler(controller.updateQrCodeStatus));

router.get('/jobs', requireAnyAdminSection('jobs', 'jobApprovals'), asyncHandler(controller.getJobs));
router.get('/jobs/:id', requireAnyAdminSection('jobs', 'jobApprovals'), asyncHandler(controller.getJob));
router.patch('/jobs/:id/status', requireJobStatusPermission, asyncHandler(controller.updateJobStatus));
router.delete('/jobs/:id', requireAdminSection('jobs'), asyncHandler(controller.deleteJob));

router.get('/applications', asyncHandler(controller.getApplications));
router.get('/applications/:id', asyncHandler(controller.getApplication));
router.get('/applications/:id/candidate', asyncHandler(controller.getApplicationCandidate));
router.get('/applications/:id/cv', asyncHandler(controller.getApplicationCv));
router.patch('/applications/:id/status', asyncHandler(controller.updateApplicationStatus));

router.get('/news', asyncHandler(controller.getNews));
router.get('/news/:id', asyncHandler(controller.getNewsItem));
router.post('/news', asyncHandler(controller.createNews));
router.patch('/news/:id', asyncHandler(controller.updateNews));
router.patch('/news/:id/status', asyncHandler(controller.updateNewsStatus));
router.delete('/news/:id', asyncHandler(controller.deleteNews));

router.get('/community-updates', asyncHandler(controller.getCommunityUpdates));
router.post('/community-updates', asyncHandler(controller.createCommunityUpdate));
router.patch('/community-updates/:id', asyncHandler(controller.updateCommunityUpdate));
router.patch('/community-updates/:id/status', asyncHandler(controller.updateCommunityUpdateStatus));
router.delete('/community-updates/:id', asyncHandler(controller.deleteCommunityUpdate));

router.get('/offers', asyncHandler(controller.getOffers));
router.get('/offers/:id', asyncHandler(controller.getOffer));
router.post('/offers', asyncHandler(controller.createOffer));
router.patch('/offers/:id', asyncHandler(controller.updateOffer));
router.patch('/offers/:id/status', asyncHandler(controller.updateOfferStatus));
router.delete('/offers/:id', asyncHandler(controller.deleteOffer));

router.get('/ads', asyncHandler(controller.getAds));
router.post('/ads', asyncHandler(controller.createAd));
router.patch('/ads/:id', asyncHandler(controller.updateAd));
router.patch('/ads/:id/status', asyncHandler(controller.updateAdStatus));
router.patch('/ads/:id/approve', asyncHandler(controller.approveAd));
router.delete('/ads/:id', asyncHandler(controller.deleteAd));

router.get('/hero-slides', asyncHandler(controller.getHeroSlides));
router.post('/hero-slides', asyncHandler(controller.createHeroSlide));
router.patch('/hero-slides/reorder', asyncHandler(controller.reorderHeroSlides));
router.patch('/hero-slides/:id', asyncHandler(controller.updateHeroSlide));
router.delete('/hero-slides/:id', asyncHandler(controller.deleteHeroSlide));

router.post('/image-links/probe', asyncHandler(controller.probeLinkedImage));

router.get('/notifications', asyncHandler(controller.getNotifications));
router.patch('/notifications/:id/read', asyncHandler(controller.markNotificationRead));
router.patch('/notifications/read-all', asyncHandler(controller.markAllNotificationsRead));

module.exports = router;
