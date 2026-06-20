const express = require('express');
const router = express.Router();
const {
  saveVersion,
  getVersionHistory,
  getSingleVersion,
  compareVersions,
  restoreVersion,
} = require('../controllers/versionController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, saveVersion);

router.post('/restore', protect, restoreVersion);
router.get('/document/:documentId', protect, getVersionHistory);
router.get('/document/:documentId/:versionNumber', protect, getSingleVersion);
router.get('/compare/:documentId', protect, compareVersions);

module.exports = router;
