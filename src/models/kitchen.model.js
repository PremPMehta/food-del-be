const mongoose = require("mongoose");
const kitchenSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    pincodes: [
      {
        type: String,
        required: true,
        match: /^[0-9]{6}$/, // Ensures each pin code is a 6-digit number
      },
    ],
    vegOnly: {
      type: Boolean,
      require: true,
    },
    masterKitchen: {
      type: Boolean,
      require: true,
    },
    isDeleted: { type: Boolean, default: false }, // Soft delete flag
    deletedAt: { type: Date, default: null }, // Optional: timestamp for soft deletion
  },
  { timestamps: true }
);

kitchenSchema.pre("find", function () {
  this.where({ isDeleted: false }); // Exclude soft-deleted items
});

kitchenSchema.pre("findOne", function () {
  this.where({ isDeleted: false }); // Exclude soft-deleted items
});

const kitchen = mongoose.model("Kitchen", kitchenSchema);

module.exports = kitchen;
