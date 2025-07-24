const mongoose = require("mongoose");
const ComboModel = require("../../models/combo.model");
const Joi = require("joi");

// The following line imports the Yup module which is used for validation
const yup = require("yup");

const comboSchema = Joi.object({
  title: Joi.string().required().messages({
    "string.empty": "Title is required.",
  }),
  description: Joi.string().required().messages({
    "string.empty": "Description is required.",
  }),
  thumbnail: Joi.string().uri().required().messages({
    "string.empty": "Thumbnail is required.",
    "string.uri": "Thumbnail must be a valid URL.",
  }),
  amount: Joi.number().required().min(0).messages({
    "number.base": "Amount must be a number.",
    "number.empty": "Amount is required.",
    "number.min": "Amount must be a positive number.",
  }),

  dishes: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[a-fA-F0-9]{24}$/)
        .messages({
          "string.pattern.base": "Dish ID must be a valid ObjectId.",
        })
    )
    .default([]),
  displayCategory: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[a-fA-F0-9]{24}$/)
        .messages({
          "string.pattern.base": "Category ID must be a valid ObjectId.",
        })
    )
    .default([]),
  diet: Joi.string().required().messages({
    "string.empty": "Diet information is required.",
  }),
});

const createCombo = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { error, value } = comboSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: error.message });
    }

    let findCombo = await ComboModel.findOne({ title: req.body.title });

    if (findCombo) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Combo already exist" });
    }

    const comboMeal = new ComboModel(req.body);
    let savedComboMeal = await comboMeal.save({ session });
    /**
     * Commit the transaction
     */
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "ComboMeal created successfully",
      data: savedComboMeal,
    });
  } catch (error) {
    await session.abortTransaction();
    // End the session
    session.endSession();
    res.status(500).json({ error: error.message });
  }
};

const updateSchema = Joi.object({
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  thumbnail: Joi.string().optional(),
  amount: Joi.number().optional(),

  dishes: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[a-fA-F0-9]{24}$/)
        .messages({
          "string.pattern.base": "Dish ID must be a valid ObjectId.",
        })
    )
    .default([]),
  displayCategory: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[a-fA-F0-9]{24}$/)
        .messages({
          "string.pattern.base": "Category ID must be a valid ObjectId.",
        })
    )
    .default([]),
  diet: Joi.string().optional(),
});
const updateCombo = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { error, value } = updateSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: error.message });
    }

    let findCombo = await ComboModel.findOne({ _id: id });

    if (!findCombo) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Combo not exist" });
    }

    let updatedCombo = await ComboModel.findByIdAndUpdate(
      { _id: findCombo._id },
      req.body,
      {
        new: true,
      }
    );
    /**
     * Commit the transaction
     */
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "ComboMeal updated successfully",
      data: updatedCombo,
    });
  } catch (error) {
    await session.abortTransaction();
    // End the session
    session.endSession();
    res.status(500).json({ error: error.message });
  }
};

const removeCombo = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "id is required" });
    }

    let findCombo = await ComboModel.findOne({ _id: id });

    if (!findCombo) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Combo not exist" });
    }

    findCombo.isDeleted = true;
    findCombo.deletedAt = Date.now();

    // Save the updated dish
    await findCombo.save({ session });
    /**
     * Commit the transaction
     */
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "ComboMeal deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    // End the session
    session.endSession();
    res.status(500).json({ error: error.message });
  }
};

// Yup schema for validation
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

const getCombos = async (req, res) => {
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
        {
          dishes: {
            $elemMatch: {
              title: { $regex: search, $options: "i" }, // Case insensitive search in category title
            },
          },
        },
        {
          displayCategory: {
            $elemMatch: {
              title: { $regex: search, $options: "i" }, // Case insensitive search in category title
            },
          },
        },
      ];
    }

    // Fetch the total count of combos matching the query
    const totalCombos = await ComboModel.countDocuments(query);

    // Fetch the paginated and sorted combos
    const combos = await ComboModel.aggregate([
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
      data: combos,
      pagination: {
        total: totalCombos,
        page,
        limit,
        totalPages: Math.ceil(totalCombos / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching combos:", error);
    res.status(400).json({
      success: false,
      message: error.errors || "Error fetching combos",
    });
  }
};

const getComboById = async (req, res) => {
  const { id } = req.params;

  try {
    /** Find the combo by Id */
    const combo = await ComboModel.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!combo) {
      return res.status(404).json({
        message: "Combo not found.",
      });
    }

    res.status(200).json({
      message: "Combo fetched successfully.",
      comboMeal: combo,
    });
  } catch (error) {
    /**
     * Log the error
     */
    console.error("Error getting combo:", error);

    /**
     * Return an error response
     */
    res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error getting combo", error });
  }
};

module.exports = {
  createCombo,
  updateCombo,
  removeCombo,
  getCombos,
  getComboById,
};
