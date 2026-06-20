const express = require('express');
const router = express.Router();
const {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocumentContent,
  deleteDocument,
  inviteCollaborator,
  updateCollaboratorPermission,
  removeCollaborator,
  searchDocuments,
} = require('../controllers/documentController');
const { protect } = require('../middleware/authMiddleware');

// Define search route before :id param routes
router.get('/search', protect, searchDocuments);

router.route('/')
  .post(protect, createDocument)
  .get(protect, getDocuments);

router.route('/:id')
  .get(protect, getDocumentById)
  .put(protect, updateDocumentContent)
  .delete(protect, deleteDocument);

// Collaborator routes
router.post('/:id/collaborators', protect, inviteCollaborator);
router.put('/:id/collaborators/:userId', protect, updateCollaboratorPermission);
router.delete('/:id/collaborators/:userId', protect, removeCollaborator);

module.exports = router;
