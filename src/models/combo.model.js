const mongoose = require("mongoose");

// Category Schema
const comboMealSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true }, // combo title
    description: { type: String, required: true }, // combo description
    thumbnail: { type: String, required: true }, // URL for combo thumbnail image
    amount: { type: Number, required: true },
    isDeleted: { type: Boolean, default: false }, // Soft delete flag
    deletedAt: { type: Date, default: null }, // Optional: timestamp for soft deletion
    dishes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Dish" }], // Reference to Dish model
    displayCategory: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    ],
    diet: { type: String, required: true },
  },
  { timestamps: true }
);

// Pre-save hook to handle soft delete logic
comboMealSchema.pre("find", function () {
  this.where({ isDeleted: false }); // Exclude soft-deleted items
});

comboMealSchema.pre("findOne", function () {
  this.where({ isDeleted: false }); // Exclude soft-deleted items
});

// Create the Category model
const comboMeal = mongoose.model("comboMeal", comboMealSchema);

module.exports = comboMeal;
