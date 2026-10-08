const express = require('express');
const controller = require('../controllers/publicController');

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get('/', asyncHandler(controller.publicCommunityUpdates));

module.exports = router;