const mongoose = require("mongoose");

// contactUs Schema
const contactUsSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

// Create the Category model
const contactUs = mongoose.model("contactUs", contactUsSchema);

module.exports = contactUs;
