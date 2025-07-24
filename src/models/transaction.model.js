const mongoose = require("mongoose");
const {
  TRANSACTION_TYPE,
  PAYMENT_METHOD,
  TRANSACTION_STATUS,
} = require("../utils/constants");

// Define the Transaction Schema
const transactionSchema = new mongoose.Schema(
  {
    payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment", // Assuming you have a PaymentToken model
      required: false, // Optional reference to the payment table
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User ", // Assuming you have a User model
      required: true, // Required reference to the user
    },
    transaction_type: {
      type: String,
      enum: [TRANSACTION_TYPE.CREDIT, TRANSACTION_TYPE.DEBIT], // Allowed values for transaction type
      required: true,
    },
    description: {
      type: String,
      required: true, // Required description of the transaction
    },
    payment_method: {
      type: String,
      enum: [
        PAYMENT_METHOD.PAYPAL,
        PAYMENT_METHOD.WALLET,
        PAYMENT_METHOD.REFERRAL_REWARD,
      ], // Allowed values for payment method
      required: true,
    },
    wallet_topUp: {
      type: Boolean,
      default: false,
    },
    order_topUp: {
      type: Boolean,
      default: false,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        TRANSACTION_STATUS.PENDING,
        TRANSACTION_STATUS.COMPLETED,
        TRANSACTION_STATUS.FAILED,
      ], // Allowed values for status
      default: "pending",
    },
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt fields
  }
);

// Create the Transaction model
const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;
