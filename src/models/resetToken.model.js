const mongoose = require('mongoose');

const passwordResetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    default: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  },
} , {
  timestamps: true
});

const PasswordResetToken = mongoose.model('resetToken', passwordResetTokenSchema);

module.exports = PasswordResetToken;