const mongoose = require("mongoose");
const KitchenModel = require("../../models/kitchen.model");
const Joi = require("joi");
const yup = require("yup");

const { findByIdAndUpdate } = require("../../models/category.model");

const createKitechenschema = Joi.object({
  title: Joi.string().required().messages({
    "string.empty": "Title is required.",
  }),
  description: Joi.string().required().messages({
    "string.empty": "Description is required.",
  }),
  vegOnly: Joi.boolean().required().messages({
    "any.required": "vegOnly is required.",
    "boolean.base": "vegOnly must be a boolean value.",
  }),
  masterKitchen: Joi.boolean().required().messages({
    "any.required": "masterKitchen is required.",
    "boolean.base": "masterKitchen must be a boolean value.",
  }),
  pincodes: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9]{6}$/)
        .required()
        .messages({
          "string.empty": "Pincode is required.",
          "string.pattern.base": "Pincode must be a 6-digit number.",
        })
    )
    .required()
    .messages({
      "array.base": "Pincodes must be an array.",
      "array.includesRequiredUnknowns": "Each pincode is required.",
    }),
});

const addKitchen = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { error, value } = createKitechenschema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: error.message });
    }

    const kitchen = new KitchenModel(req.body);
    let savedkitchen = await kitchen.save({ session });
    /**
     * Commit the transaction
     */
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "kitchen created successfully",
      data: savedkitchen,
    });
  } catch (error) {
    await session.abortTransaction();
    // End the session
    session.endSession();
    res.status(500).json({ error: error.message });
  }
};

const updateKitechenschema = Joi.object({
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  vegOnly: Joi.boolean().optional(),
  masterKitchen: Joi.boolean().optional(),
  pincodes: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9]{6}$/)
        .required()
        .messages({
          "string.empty": "Pincode is required.",
          "string.pattern.base": "Pincode must be a 6-digit number.",
        })
    )
    .required()
    .messages({
      "array.base": "Pincodes must be an array.",
      "array.includesRequiredUnknowns": "Each pincode is required.",
    }),
});
const updateKitchen = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params; // Get the dish ID from the request parameters
    const updates = req.body;
    const { error, value } = updateKitechenschema.validate(updates, {
      abortEarly: false,
    });
    if (error) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: error.message });
    }

    const kitchen = await KitchenModel.findOne({ _id: id });
    if (!kitchen) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "kitchen not found" });
    }

    let upadtedData = await KitchenModel.findByIdAndUpdate(
      { _id: kitchen._id },
      req.body,
      { new: true }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "kitchen created successfully",
      data: upadtedData,
    });
  } catch (error) {
    await session.abortTransaction();
    // End the session
    session.endSession();
    res.status(400).json({ error: error.message });
  }
};

const removeKitchen = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const kitchen = await KitchenModel.findOne({ _id: id });
    if (!kitchen) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "kitchen not found" });
    }
    kitchen.isDeleted = true;
    kitchen.deletedAt = Date.now();

    // Save the updated dish
    await kitchen.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    // End the session
    session.endSession();

    // Return a successful response
    res.status(200).json({ message: "kitchen deleted successfully!" });
  } catch (error) {
    await session.abortTransaction();
    // End the session
    session.endSession();
    res.status(400).json({ error: error.message });
  }
};

const getAllKitchen = async (req, res) => {
  try {
    const kitchen = await KitchenModel.find();
    if (!kitchen) {
      return res.status(404).json({ message: "kitchen not found" });
    }

    let response = kitchen.map((item) => ({
      _id: item._id,
      title: item.title,
    }));

    res
      .status(200)
      .json({
        message: "fetch all kitech successfully",
        data: response,
        success: true,
      });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const querySchema = yup.object().shape({
  page: yup.number().integer().min(1).default(1),
  limit: yup.number().integer().min(1).max(100).default(10),
  sortBy: yup
    .string()
    .oneOf(["title", "dishSalePrice", "createdAt"], "Invalid sort field")
    .default("createdAt"),
  sortOrder: yup
    .string()
    .oneOf(["asc", "desc"], "Invalid sort order")
    .default("desc"),
  search: yup.string().optional(),
});

const getKitchens = async (req, res) => {
  try {
    // Validate query parameters
    const validatedQuery = await querySchema.validate(req.query, {
      abortEarly: false,
    });

    const { page, limit, sortBy, sortOrder, search } = validatedQuery;

    // Build the query
    const query = {
      isDeleted: false, // Exclude soft-deleted items
    };

    // If a search term is provided , include it in the query
    if (search) {
      // Add search condition for title, description, categories, and options
      query.$or = [
        { title: { $regex: search, $options: "i" } }, // Case insensitive search in title
        { description: { $regex: search, $options: "i" } }, // Case insensitive search in description
      ];
    }

    // Fetch the total count of kitchens matching the query
    const totalKitchens = await KitchenModel.countDocuments(query);

    // Fetch the paginated and sorted kitchens
    const kitchens = await KitchenModel.aggregate([
      {
        $match: query,
      },
      { $sort: { [sortBy]: sortOrder === "asc" ? 1 : -1, _id: 1 } }, // Sort by sortBy and a secondary field like _id
      { $skip: (page - 1) * limit }, // Skip the number of documents based on the page
      { $limit: limit }, // Limit the number of documents returned
    ]);

    // return the response
    return res.status(200).json({
      success: true,
      data: kitchens,
      pagination: {
        total: totalKitchens,
        page,
        limit,
        totalPages: Math.ceil(totalKitchens / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching kitchens:", error);
    res.status(400).json({
      success: false,
      message: error.errors || "Error fetching kitchens",
    });
  }
};

const getKitchenById = async (req, res) => {
  const { id } = req.params;

  try {
    /** Find the kitchen by Id */
    const kitchen = await KitchenModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!kitchen) {
      return res.status(404).json({
        message: "Kitchen not found.",
      });
    }

    res.status(200).json({
      message: "Kitchen fetched successfully.",
      kitchen: kitchen,
    });
  } catch (error) {
    /**
     * Log the error
     */
    console.error("Error getting kitchen:", error);

    /**
     * Return an error response
     */
    res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error getting kitchen", error });
  }
};

module.exports = {
  addKitchen,
  updateKitchen,
  removeKitchen,
  getAllKitchen,
  getKitchens,
  getKitchenById,
};
