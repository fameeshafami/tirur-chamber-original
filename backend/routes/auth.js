const express = require('express');
const { registerUser, loginUser, logoutUser, getCurrentUser, changePassword, requestPasswordReset, resetPassword } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', verifyToken, logoutUser);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.get('/me', verifyToken, getCurrentUser);
router.patch('/password', verifyToken, changePassword);

module.exports = router;
