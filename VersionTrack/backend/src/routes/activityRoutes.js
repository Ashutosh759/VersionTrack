const express = require('express');
const router = express.Router();
const { getActivitiesByDocument } = require('../controllers/activityController');
const { protect } = require('../middleware/authMiddleware');

router.get('/document/:documentId', protect, getActivitiesByDocument);

module.exports = router;
