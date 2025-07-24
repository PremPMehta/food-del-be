const mongoose = require("mongoose");
const { CATEGORY_STATUS } = require("../utils/constants");

// Category Schema
const categorySchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // Category title
    description: { type: String, required: true }, // Category description
    thumbnail: { type: String, required: true }, // URL for category thumbnail image
    status: {
      type: String,
      enum: [CATEGORY_STATUS.ACTIVE, CATEGORY_STATUS.INACTIVE],
      default: CATEGORY_STATUS.ACTIVE,
    }, // Status of the category
    isDeleted: { type: Boolean, default: false }, // Soft delete flag
    deletedAt: { type: Date, default: null }, // Optional: timestamp for soft deletion
    dishes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Dish" }], // Reference to Dish model
    type: { type: String },
  },
  { timestamps: true }
);

// Pre-save hook to handle soft delete logic
categorySchema.pre("find", function () {
  this.where({ isDeleted: false }); // Exclude soft-deleted items
});

categorySchema.pre("findOne", function () {
  this.where({ isDeleted: false }); // Exclude soft-deleted items
});

// Create the Category model
const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
