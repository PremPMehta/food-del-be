const mongoose = require("mongoose");

// Thal Schema
const thalSchema = new mongoose.Schema(
  {
    categories: [
      {
        category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true }, // Reference to Category model
        order: { type: Number, required: true }, // Order in which the category should be displayed
      },
    ],
  },
  { timestamps: true }
);

// Create the Thal model
const Thal = mongoose.model("Thal", thalSchema);

module.exports = Thal;