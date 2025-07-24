const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid"); // Import the UUID package
const { DISH_STATUS, DISH_TYPE } = require("../utils/constants");

// Customize Option Schema
const customizeOptionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    priceAddOn: { type: Number, required: true },
    // priceFastFoodAddOn: { type: Number, required: true },
    // priceDishAddon: { type: Number, required: true },
  },
  {
    timestamps: true,
  }
);

// Customize Category Schema
const customizeCategorySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    options: { type: [customizeOptionSchema], required: true }, // Options are required
    allowMultiple: { type: Boolean, default: false }, // Allow multiple selections?
    limit: {
      type: Number,
      required: function () {
        return this.allowMultiple;
      }, // Required if allowMultiple is true
    },
    defaultOption: { type: String, required: true }, // Default option title (can be the UUID of the default option)
  },
  {
    timestamps: true,
  }
);

// Dish Schema
const dishSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    dishMrp: { type: Number, required: true },
    dishSalePrice: { type: Number, required: true },
    normalMrp: { type: Number, required: true },
    normalSalePrice: { type: Number, required: true },
    thalMrp: { type: Number, required: true },
    thalSalePrice: { type: Number, required: true },
    diet: {
      type: String,
      required: true,
      enum: [
        DISH_TYPE.VEG,
        DISH_TYPE.NON_VEG,
        DISH_TYPE.VEGAN,
        DISH_TYPE.EGGETARIAN,
        DISH_TYPE.JAIN,
      ],
    },
    customizable: { type: Boolean, required: true }, // Customizable is required
    customizeCategories: {
      type: [customizeCategorySchema],
      required: function () {
        return this.customizable;
      }, // Required if customizable is true
    },
    status: {
      type: String,
      enum: [DISH_STATUS.ACTIVE, DISH_STATUS.INACTIVE],
      default: DISH_STATUS.ACTIVE,
    }, // New status field
    isDeleted: { type: Boolean, default: false }, // Soft delete flag
    deletedAt: { type: Date, default: null }, // Optional: timestamp for soft deletion
    recommendation: [{ type: mongoose.Schema.Types.ObjectId, ref: "Dish" }],
  },
  { timestamps: true }
);

dishSchema.pre("find", function () {
  this.where({ isDeleted: false }); // Exclude soft-deleted items
});

dishSchema.pre("findOne", function () {
  this.where({ isDeleted: false }); // Exclude soft-deleted items
});

// Create the Dish model
const Dish = mongoose.model("Dish", dishSchema);

module.exports = Dish;
