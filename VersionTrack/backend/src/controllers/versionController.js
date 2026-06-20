const diff = require('diff');
const Document = require('../models/Document');
const Version = require('../models/Version');
const Activity = require('../models/Activity');

// @desc    Save a new version of the document
// @route   POST /api/versions
// @access  Private
const saveVersion = async (req, res) => {
  try {
    const { documentId, changeSummary } = req.body;

    if (!documentId) {
      return res.status(400).json({ message: 'Document ID is required' });
    }

    const document = await Document.findOne({ _id: documentId, isDeleted: false });
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
      return res.status(403).json({ message: 'Not authorized to save versions for this document' });
    }

    // Increment document version number
    const newVersionNumber = document.currentVersion + 1;

    // Create the version record
    const version = await Version.create({
      documentId: document._id,
      versionNumber: newVersionNumber,
      content: document.content,
      editor: req.user._id,
      changeSummary: changeSummary || `Version ${newVersionNumber}`,
    });

    // Update document's current version index
    document.currentVersion = newVersionNumber;
    await document.save();

    // Log Activity
    await Activity.create({
      documentId: document._id,
      user: req.user._id,
      action: 'VERSION_SAVED',
      details: {
        versionNumber: newVersionNumber,
        changeSummary: changeSummary || `Saved version ${newVersionNumber}`,
      },
    });

    res.status(201).json(version);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get version history for a document
// @route   GET /api/versions/document/:documentId
// @access  Private
const getVersionHistory = async (req, res) => {
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
      return res.status(403).json({ message: 'Not authorized to view history' });
    }

    const versions = await Version.find({ documentId })
      .populate('editor', 'username email')
      .sort({ versionNumber: -1 });

    res.json(versions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get a single version by document ID and version number
// @route   GET /api/versions/document/:documentId/:versionNumber
// @access  Private
const getSingleVersion = async (req, res) => {
  try {
    const { documentId, versionNumber } = req.params;

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
      return res.status(403).json({ message: 'Not authorized to view this version' });
    }

    const version = await Version.findOne({
      documentId,
      versionNumber: parseInt(versionNumber),
    }).populate('editor', 'username email');

    if (!version) {
      return res.status(404).json({ message: 'Version not found' });
    }

    res.json(version);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Compare two versions
// @route   GET /api/versions/compare/:documentId
// @access  Private
// @query   baseVersion=1&compareVersion=2
const compareVersions = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { baseVersion, compareVersion } = req.query;

    if (!baseVersion || !compareVersion) {
      return res.status(400).json({ message: 'Both baseVersion and compareVersion query params are required' });
    }

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
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Fetch versions
    const baseVer = await Version.findOne({
      documentId,
      versionNumber: parseInt(baseVersion),
    }).populate('editor', 'username email');

    const compareVer = await Version.findOne({
      documentId,
      versionNumber: parseInt(compareVersion),
    }).populate('editor', 'username email');

    if (!baseVer || !compareVer) {
      return res.status(404).json({ message: 'One or both versions not found' });
    }

    // Run diff
    // diffLines gives line-by-line comparisons
    const lineDiff = diff.diffLines(baseVer.content, compareVer.content);

    res.json({
      baseVersion: {
        versionNumber: baseVer.versionNumber,
        editor: baseVer.editor,
        createdAt: baseVer.createdAt,
      },
      compareVersion: {
        versionNumber: compareVer.versionNumber,
        editor: compareVer.editor,
        createdAt: compareVer.createdAt,
      },
      diff: lineDiff,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Restore a version (copy content to new version)
// @route   POST /api/versions/restore
// @access  Private
const restoreVersion = async (req, res) => {
  try {
    const { documentId, versionNumber } = req.body;

    if (!documentId || !versionNumber) {
      return res.status(400).json({ message: 'documentId and versionNumber are required' });
    }

    const document = await Document.findOne({ _id: documentId, isDeleted: false });
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Verify edit permissions
    const userId = req.user._id.toString();
    const isOwner = document.owner.toString() === userId;
    const isEditor = document.collaborators.some(
      (c) => c.user.toString() === userId && c.permission === 'editor'
    );

    if (!isOwner && !isEditor) {
      return res.status(403).json({ message: 'Not authorized to modify this document' });
    }

    // Get the version to restore
    const targetVersion = await Version.findOne({
      documentId,
      versionNumber: parseInt(versionNumber),
    });

    if (!targetVersion) {
      return res.status(404).json({ message: 'Target version not found' });
    }

    // Create a new version copy of the target version's content
    const newVersionNumber = document.currentVersion + 1;
    const newVersion = await Version.create({
      documentId: document._id,
      versionNumber: newVersionNumber,
      content: targetVersion.content,
      editor: req.user._id,
      changeSummary: `Restored back to Version ${versionNumber}`,
    });

    // Update current document working content and current version index
    document.content = targetVersion.content;
    document.currentVersion = newVersionNumber;
    await document.save();

    // Log Activity
    await Activity.create({
      documentId: document._id,
      user: req.user._id,
      action: 'ROLLBACK_PERFORMED',
      details: {
        restoredVersionNumber: targetVersion.versionNumber,
        newVersionNumber: newVersionNumber,
      },
    });

    res.json({
      message: `Successfully restored to Version ${versionNumber}`,
      document,
      newVersion,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  saveVersion,
  getVersionHistory,
  getSingleVersion,
  compareVersions,
  restoreVersion,
};
