const mongoose = require('mongoose');

const referralSettingsSchema = new mongoose.Schema({
  level: {
    type: Number,
    required: true,
    enum: [1, 2, 3], // Only allow levels 1, 2, and 3
  },
  membershipBonus: {
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100, // Percentage should be between 0 and 100
    },
    maxBonus: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  topUpBonus: {
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100, // Percentage should be between 0 and 100
    },
    maxBonus: {
      type: Number,
      required: true,
      min: 0,
    },
  },
});

// Create the ReferralPlan model
const ReferralSettings = mongoose.model('ReferralSettings', referralSettingsSchema);

module.exports = ReferralSettings;