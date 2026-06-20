const Document = require('../models/Document');
const Activity = require('../models/Activity');

// @desc    Get all activities for a document
// @route   GET /api/activities/document/:documentId
// @access  Private
const getActivitiesByDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await Document.findOne({ _id: documentId, isDeleted: false });
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Verify access
    const userId = req.user._id.toString();
    const isOwner = document.owner.toString() === userId;
    const isCollaborator = document.collaborators.some(
      (c) => c.user.toString() === userId
    );

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: 'Not authorized to view activities for this document' });
    }

    const activities = await Activity.find({ documentId })
      .populate('user', 'username email')
      .sort({ createdAt: -1 });

    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getActivitiesByDocument,
};
