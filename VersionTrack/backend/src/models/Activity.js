const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: [
        'DOCUMENT_CREATED',
        'DOCUMENT_UPDATED',
        'VERSION_SAVED',
        'ROLLBACK_PERFORMED',
        'COLLABORATOR_INVITED',
        'COLLABORATOR_REMOVED',
        'PERMISSION_CHANGED',
      ],
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes for query performance
activitySchema.index({ documentId: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
