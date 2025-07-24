// Import Mongoose
const mongoose = require("mongoose");
const { USER_STATUS, USER_ROLE } = require("../utils/constants");

// Define the admin user schema
const adminUserScema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    role: {
      type: String,
      enum: [USER_ROLE.ADMIN, USER_ROLE.SUPERADMIN],
      default: "admin",
    },
    status: {
      type: String,
      enum: [USER_STATUS.PENDING, USER_STATUS.ACTIVE, USER_STATUS.INACTIVE],
      default: USER_STATUS.PENDING,
    }, // New status field
    kitchen: [{ type: mongoose.Schema.Types.ObjectId, ref: "Kitchen" }],
    deleted: {
      type: Boolean,
      default: false, // Default value is false, meaning not deleted
    },
  },
  { timestamps: true }
);

/**
 * Pre middleware hook for the find and findOne methods.
 * It adds a filter to exclude documents with deleted set to true.
 */
adminUserScema.pre("find", function () {
  // Exclude documents with deleted set to true
  this.where({ deleted: false });
});

/**
 * Pre middleware hook for the findOne method.
 * It adds a filter to exclude documents with deleted set to true.
 */
adminUserScema.pre("findOne", function () {
  // Exclude documents with deleted set to true
  this.where({ deleted: false });
});

// Create the model
const AdminUser = mongoose.model("AdminUser", adminUserScema);

// Export the model
module.exports = AdminUser;
