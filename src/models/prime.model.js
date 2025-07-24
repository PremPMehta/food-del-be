const mongoose = require("mongoose");

const userPrimeSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date }, // Calculate based on plan duration
  paymentStatus: {
    type: String,
    enum: ["pending", "success", "failed"],
    default: "pending",
  },
  razorpayPaymentId: { type: String }, // Razorpay payment reference
});

const UserPrimeSubscription = mongoose.model(
  "UserPrimeSubscription",
  userPrimeSubscriptionSchema
);

module.exports = UserPrimeSubscription;
