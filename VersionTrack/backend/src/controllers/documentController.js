const Document = require('../models/Document');
const User = require('../models/User');
const Version = require('../models/Version');
const Activity = require('../models/Activity');

// @desc    Create a new document
// @route   POST /api/documents
// @access  Private
const createDocument = async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const document = await Document.create({
      title,
      content: content || '',
      owner: req.user._id,
      currentVersion: 1,
      collaborators: [],
    });

    // Create the initial version
    const initialVersion = await Version.create({
      documentId: document._id,
      versionNumber: 1,
      content: content || '',
      editor: req.user._id,
      changeSummary: 'Initial document creation',
    });

    // Log activity
    await Activity.create({
      documentId: document._id,
      user: req.user._id,
      action: 'DOCUMENT_CREATED',
      details: { title, versionNumber: 1 },
    });

    res.status(201).json(document);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all documents for user (owned or collaborating)
// @route   GET /api/documents
// @access  Private
const getDocuments = async (req, res) => {
  try {
    const userId = req.user._id;

    // Retrieve documents where user is owner or collaborator, excluding soft deleted ones
    const documents = await Document.find({
      isDeleted: false,
      $or: [
        { owner: userId },
        { 'collaborators.user': userId },
      ],
    })
      .populate('owner', 'username email')
      .populate('collaborators.user', 'username email')
      .sort({ updatedAt: -1 });

    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get a single document by ID
// @route   GET /api/documents/:id
// @access  Private
const getDocumentById = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      isDeleted: false,
    })
      .populate('owner', 'username email')
      .populate('collaborators.user', 'username email');

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Verify access
    const userId = req.user._id.toString();
    const isOwner = document.owner._id.toString() === userId;
    const isCollaborator = document.collaborators.some(
      (c) => c.user._id.toString() === userId
    );

    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ message: 'Not authorized to view this document' });
    }

    // Determine permissions
    let role = 'viewer';
    if (isOwner) {
      role = 'owner';
    } else {
      const collab = document.collaborators.find(
        (c) => c.user._id.toString() === userId
      );
      if (collab) {
        role = collab.permission;
      }
    }

    // Attach role dynamically to response
    const documentObj = document.toObject();
    documentObj.role = role;

    res.json(documentObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update document content (working copy)
// @route   PUT /api/documents/:id
// @access  Private
const updateDocumentContent = async (req, res) => {
  try {
    const { title, content } = req.body;
    const document = await Document.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Verify permission (must be owner or editor collaborator)
    const userId = req.user._id.toString();
    const isOwner = document.owner.toString() === userId;
    const isEditor = document.collaborators.some(
      (c) => c.user.toString() === userId && c.permission === 'editor'
    );

    if (!isOwner && !isEditor) {
      return res.status(403).json({ message: 'Not authorized to edit this document' });
    }

    if (title !== undefined) document.title = title;
    if (content !== undefined) document.content = content;

    await document.save();

    // Log a general update activity
    await Activity.create({
      documentId: document._id,
      user: req.user._id,
      action: 'DOCUMENT_UPDATED',
      details: { titleChanged: title !== undefined, contentChanged: content !== undefined },
    });

    res.json(document);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a document (soft delete)
// @route   DELETE /api/documents/:id
// @access  Private
const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Only owner can delete
    if (document.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can delete this document' });
    }

    document.isDeleted = true;
    await document.save();

    res.json({ message: 'Document removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Invite collaborator to a document
// @route   POST /api/documents/:id/collaborators
// @access  Private
const inviteCollaborator = async (req, res) => {
  try {
    const { emailOrUsername, permission } = req.body;
    const document = await Document.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Only owner can invite collaborators
    if (document.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can manage collaborators' });
    }

    // Find the user to invite
    const invitee = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });

    if (!invitee) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if invitee is the owner
    if (invitee._id.toString() === document.owner.toString()) {
      return res.status(400).json({ message: 'User is the owner of the document' });
    }

    // Check if user is already a collaborator
    const isAlreadyCollaborator = document.collaborators.some(
      (c) => c.user.toString() === invitee._id.toString()
    );

    if (isAlreadyCollaborator) {
      return res.status(400).json({ message: 'User is already a collaborator' });
    }

    // Add collaborator
    document.collaborators.push({
      user: invitee._id,
      permission: permission || 'viewer',
    });

    await document.save();

    // Log Activity
    await Activity.create({
      documentId: document._id,
      user: req.user._id,
      action: 'COLLABORATOR_INVITED',
      details: {
        collaboratorUsername: invitee.username,
        permission: permission || 'viewer',
      },
    });

    const updatedDoc = await Document.findById(document._id)
      .populate('collaborators.user', 'username email');

    res.json(updatedDoc.collaborators);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update collaborator permission
// @route   PUT /api/documents/:id/collaborators/:userId
// @access  Private
const updateCollaboratorPermission = async (req, res) => {
  try {
    const { permission } = req.body;
    const document = await Document.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Only owner can update collaborator permissions
    if (document.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can manage collaborators' });
    }

    // Find collaborator index
    const collaboratorIndex = document.collaborators.findIndex(
      (c) => c.user.toString() === req.params.userId
    );

    if (collaboratorIndex === -1) {
      return res.status(404).json({ message: 'Collaborator not found' });
    }

    document.collaborators[collaboratorIndex].permission = permission;
    await document.save();

    // Find target user for details
    const targetUser = await User.findById(req.params.userId);

    // Log Activity
    await Activity.create({
      documentId: document._id,
      user: req.user._id,
      action: 'PERMISSION_CHANGED',
      details: {
        collaboratorUsername: targetUser ? targetUser.username : 'Unknown User',
        newPermission: permission,
      },
    });

    const updatedDoc = await Document.findById(document._id)
      .populate('collaborators.user', 'username email');

    res.json(updatedDoc.collaborators);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove collaborator from a document
// @route   DELETE /api/documents/:id/collaborators/:userId
// @access  Private
const removeCollaborator = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Only owner can remove collaborators
    if (document.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can manage collaborators' });
    }

    // Remove collaborator
    document.collaborators = document.collaborators.filter(
      (c) => c.user.toString() !== req.params.userId
    );

    await document.save();

    // Find target user for details
    const targetUser = await User.findById(req.params.userId);

    // Log Activity
    await Activity.create({
      documentId: document._id,
      user: req.user._id,
      action: 'COLLABORATOR_REMOVED',
      details: {
        collaboratorUsername: targetUser ? targetUser.username : 'Unknown User',
      },
    });

    const updatedDoc = await Document.findById(document._id)
      .populate('collaborators.user', 'username email');

    res.json(updatedDoc.collaborators);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search documents
// @route   GET /api/documents/search
// @access  Private
const searchDocuments = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }

    const userId = req.user._id;

    // Search documents where query matches title and user is owner or collaborator
    const documents = await Document.find({
      isDeleted: false,
      $or: [
        { owner: userId },
        { 'collaborators.user': userId },
      ],
      title: { $regex: q, $options: 'i' },
    })
      .populate('owner', 'username email')
      .sort({ updatedAt: -1 });

    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createDocument,
  getDocuments,
  getDocumentById,
  updateDocumentContent,
  deleteDocument,
  inviteCollaborator,
  updateCollaboratorPermission,
  removeCollaborator,
  searchDocuments,
};
