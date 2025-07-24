// Import Mongoose
const mongoose = require("mongoose");
const {
  USER_ROLE,
  USER_STATUS,
  TRANSACTION_TYPE,
} = require("../utils/constants");

// Function to generate a random referral code
const generateReferralCode = () => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let referralCode = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    referralCode += characters[randomIndex];
  }
  return referralCode;
};

const addressSchema = new mongoose.Schema(
  {
    line1: {
      type: String,
      required: true,
    },
    line2: {
      type: String,
      required: false,
    },
    area: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
      default: "Surat",
    },
    pincode: {
      type: String,
      required: true,
    },
    tag: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Define the schema
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    walletBalance: { type: Number, default: 0 },

    paymentHistory: [
      {
        payment_id: { type: String, required: false },
        reference_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Payment",
          required: false,
        },
        amount: { type: Number, required: true },
        transaction_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Transaction",
        },
        starting_balance: { type: Number, required: true },
        transaction_type: {
          type: String,
          enum: [TRANSACTION_TYPE.CREDIT, TRANSACTION_TYPE.DEBIT],
        },
        closing_balance: { type: Number, required: true },
        description: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    // Flow Prime Membership fields
    isPrimeMember: { type: Boolean, default: false }, // Indicates if the user is a prime member
    role: {
      type: String,
      enum: [USER_ROLE.USER, USER_ROLE.ADMIN],
      default: "user",
    },
    status: {
      type: String,
      enum: [USER_STATUS.PENDING, USER_STATUS.ACTIVE, USER_STATUS.INACTIVE],
      default: "active",
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    referralCode: { type: String, unique: true }, // New referral code field
    directReferrer: { type: mongoose.Schema.Types.ObjectId, ref: "User " }, // Field for direct referrer (optional)
    referralParents: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Referred user's ID (optional)
        level: { type: Number, min: 1, max: 3 }, // Level of referral (1 to 3, optional)
      },
    ],
    addresses: {
      type: [addressSchema],
      required: false,
    },
  },
  { timestamps: true }
);

// Pre-save hook to generate a unique referral code
userSchema.pre("save", async function (next) {
  if (this.isNew) {
    let code;
    do {
      code = generateReferralCode();
    } while (await this.constructor.findOne({ referralCode: code })); // Check for uniqueness
    this.referralCode = code;
  }
  next();
});

/**
 * Pre middleware hook for the find and findOne methods.
 * It adds a filter to exclude documents with deleted set to true.
 */
userSchema.pre("find", function () {
  this.where({ isDeleted: false });
});

userSchema.pre("findOne", function () {
  this.where({ isDeleted: false });
});

// Create the model
const User = mongoose.model("User ", userSchema); // Removed extra space after 'User '

// Export the model
module.exports = User;
