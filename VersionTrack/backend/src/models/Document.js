const mongoose = require('mongoose');

const collaboratorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  permission: {
    type: String,
    enum: ['editor', 'viewer'],
    default: 'viewer',
  },
});

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a document title'],
      trim: true,
    },
    content: {
      type: String,
      default: '',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    collaborators: [collaboratorSchema],
    currentVersion: {
      type: Number,
      default: 1,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for scaling
documentSchema.index({ owner: 1 });
documentSchema.index({ 'collaborators.user': 1 });
documentSchema.index({ title: 'text' }); // for search capability

module.exports = mongoose.model('Document', documentSchema);
