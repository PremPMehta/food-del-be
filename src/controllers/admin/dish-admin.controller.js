// The following line imports the mongoose module which is used to interact with MongoDB
const mongoose = require("mongoose");

// The following line imports the Yup module which is used for validation
const yup = require("yup");

// The following line imports the DishModel which is a mongoose model that represents a dish in the database
const DishModel = require("../../models/dish.model");
const { DISH_STATUS, DISH_TYPE } = require("../../utils/constants");

const Joi = require("joi");
/**
 * The createDishSchema is a Yup object that validates the request body
 * when creating a new dish. It requires the following fields:
 * - imageUrl: a string representing the URL of the dish image
 * - title: a string representing the title of the dish
 * - description: a string representing the description of the dish
 * - dishMrp: a number representing the dish MRP
 * - dishSalePrice: a number representing the dish sale price
 * - normalMrp: a number representing the normal MRP
 * - normalSalePrice: a number representing the normal sale price
 * - thalMrp: a number representing the thal MRP
 * - thalSalePrice: a number representing the thal sale price
 * - customizable: a boolean value indicating if the dish is customizable
 * - customizeCategories: an array of objects representing the categories
 *   for customization. This field is required only if customizable is true.
 *   Each category object must have the following fields:
 *   - title: a string representing the title of the category
 *   - allowMultiple: a boolean value indicating if multiple options can be
 *     selected for this category
 *   - limit: a number representing the limit of options that can be selected
 *     for this category. This field is required only if allowMultiple is true.
 *   - defaultOption: a string representing the title of the default option
 *     for this category
 *   - options: an array of objects representing the options for this category.
 *     Each option object must have the following fields:
 *     - title: a string representing the title of the option
 *     - priceAddOn: a number representing the price add on for this option
 * If any of the above fields are missing or invalid, the schema will throw an error.
 */
const createDishSchema = Joi.object({
  imageUrl: Joi.string().required().messages({
    "any.required": "Image URL is required",
  }),
  title: Joi.string().required().messages({
    "any.required": "Title is required",
  }),
  description: Joi.string().required().messages({
    "any.required": "Description is required",
  }),
  dishMrp: Joi.number().min(0).required().messages({
    "any.required": "Dish MRP is required",
    "number.min": "Dish MRP must be at least 0",
  }),
  dishSalePrice: Joi.number().min(0).required().messages({
    "any.required": "Dish sale price is required",
    "number.min": "Dish sale price must be at least 0",
  }),
  normalMrp: Joi.number().min(0).required().messages({
    "any.required": "Normal MRP is required",
    "number.min": "Normal MRP must be at least 0",
  }),
  normalSalePrice: Joi.number().min(0).required().messages({
    "any.required": "Normal sale price is required",
    "number.min": "Normal sale price must be at least 0",
  }),
  thalMrp: Joi.number().min(0).required().messages({
    "any.required": "Thal MRP is required",
    "number.min": "Thal MRP must be at least 0",
  }),
  thalSalePrice: Joi.number().min(0).required().messages({
    "any.required": "Thal sale price is required",
    "number.min": "Thal sale price must be at least 0",
  }),

  diet: Joi.string()
    .valid(
      DISH_TYPE.VEG,
      DISH_TYPE.NON_VEG,
      DISH_TYPE.VEGAN,
      DISH_TYPE.EGGETARIAN,
      DISH_TYPE.JAIN
    )
    .required()
    .messages({
      "any.required": "Diet is required",
      "any.only": "Diet must be one of the specified values",
    }),
  customizable: Joi.boolean().required().messages({
    "any.required": "Customizable is required",
  }),
  customizeCategories: Joi.array().when("customizable", {
    is: true,
    then: Joi.array()
      .items(
        Joi.object({
          title: Joi.string().required().messages({
            "any.required": "Title is required",
          }),
          allowMultiple: Joi.boolean().required().messages({
            "any.required": "Allow multiple is required",
          }),
          limit: Joi.number()
            .min(0)
            .when("allowMultiple", {
              is: true,
              then: Joi.number().min(0).required().messages({
                "any.required": "Limit is required",
                "number.min": "Limit must be at least 0",
              }),
              otherwise: Joi.number().min(0).optional().default(0),
            }),
          defaultOption: Joi.string().required().messages({
            "any.required": "Default option is required",
          }),
          options: Joi.array()
            .items(
              Joi.object({
                title: Joi.string().required().messages({
                  "any.required": "Title is required",
                }),
                priceAddOn: Joi.number().min(0).required().messages({
                  "any.required": "Price add on is required",
                  "number.min": "Price add on must be at least 0",
                }),
              })
            )
            .min(1)
            .required()
            .messages({
              "array.min": "At least one option is required",
            }),
        })
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one category is required",
      }),
    otherwise: Joi.array().optional(),
  }),
  recommendation: Joi.array()
    .items(
      Joi.string().custom((value, helper) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helper.message("Invalid ObjectID");
        }
        return value;
      })
    )
    .min(1)
    .messages({
      "array.min": "At least one dish is required",
    }),
});

/**
 * The createDish function creates a new dish in the database.
 * It validates the request body using the createDishSchema
 * and then creates a new DishModel object with the validated data.
 * The function then saves the dish to the database and commits the
 * transaction. If any error occurs during the process, it aborts the
 * transaction and sends a 400 or 500 status code response.
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<void>}
 */
const createDish = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    /**
     * Validate the request body using the createDishSchema
     */
    const { error, value } = createDishSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: error.message });
    }

    /**
     * Create a new DishModel object with the validated data
     */

    const dish = new DishModel(req.body);
    let savedDish = await dish.save({ session });

    if (req.body.recommendation && Array.isArray(req.body.recommendation)) {
      const recommendedDishIds = req.body.recommendation;
      console.log("recommendedDishIds", recommendedDishIds);
      /**
       * Add the created dish's _id to the recommendation array of the listed dishes
       */
      await DishModel.updateMany(
        { _id: { $in: recommendedDishIds } }, // Find dishes with the provided _id list
        { $addToSet: { recommendation: savedDish._id } }, // Add the created dish's _id to the `recommendations` array
        { session } // Use the current transaction session
      );
    }

    /**
     * Commit the transaction
     */
    await session.commitTransaction();
    session.endSession();

    /**
     * Return the created dish in the response
     */
    const response = JSON.parse(JSON.stringify(dish));

    response["id"] = response._id;

    delete response._id;
    delete response.__v;

    return res.status(201).json({
      message: "Dish created successfully",
      data: response,
    });
  } catch (error) {
    /**
     * Abort the transaction if any error occurs
     */
    await session.abortTransaction();
    session.endSession();
    console.log(error);
    return res.status(error.code ?? 500).json({ message: error.message });
  }
};

const updateDishSchema = Joi.object({
  imageUrl: Joi.string().optional(),
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  dishMrp: Joi.number().min(0).allow(null).optional().messages({
    "number.min": "Price cannot be less than 0.",
  }),
  dishSalePrice: Joi.number().min(0).allow(null).optional().messages({
    "number.min": "Price cannot be less than 0.",
  }),
  normalMrp: Joi.number().min(0).allow(null).optional().messages({
    "number.min": "Price cannot be less than 0.",
  }),
  normalSalePrice: Joi.number().min(0).allow(null).optional().messages({
    "number.min": "Price cannot be less than 0.",
  }),
  thalMrp: Joi.number().min(0).allow(null).optional().messages({
    "number.min": "Price cannot be less than 0.",
  }),
  thalSalePrice: Joi.number().min(0).allow(null).optional().messages({
    "number.min": "Price cannot be less than 0.",
  }),
  diet: Joi.string()
    .valid(
      DISH_TYPE.VEG,
      DISH_TYPE.NON_VEG,
      DISH_TYPE.VEGAN,
      DISH_TYPE.EGGETARIAN,
      DISH_TYPE.JAIN
    )
    .optional(),
  customizable: Joi.boolean().required().messages({
    "any.required": "Customizable is required",
  }),
  customizeCategories: Joi.array().when("customizable", {
    is: true,
    then: Joi.array()
      .items(
        Joi.object({
          _id: Joi.string().optional(),
          title: Joi.string().required().messages({
            "any.required": "Title is required",
          }),
          allowMultiple: Joi.boolean().required().messages({
            "any.required": "Allow multiple is required",
          }),
          limit: Joi.number()
            .min(0)
            .when("allowMultiple", {
              is: true,
              then: Joi.number().min(0).required().messages({
                "any.required": "Limit is required",
                "number.min": "Limit must be at least 0",
              }),
              otherwise: Joi.number().min(0).optional().default(0),
            }),
          defaultOption: Joi.string().required().messages({
            "any.required": "Default option is required",
          }),
          options: Joi.array()
            .items(
              Joi.object({
                _id: Joi.string().optional(),
                title: Joi.string().required().messages({
                  "any.required": "Title is required",
                }),
                priceAddOn: Joi.number().min(0).required().messages({
                  "any.required": "Price add on is required",
                  "number.min": "Price add on must be at least 0",
                }),
              })
            )
            .min(1)
            .required()
            .messages({
              "array.min": "At least one option is required",
            }),
        })
      )
      .min(1)
      .required()
      .messages({
        "array.min": "At least one category is required",
      }),
    otherwise: Joi.array().optional(),
  }),
  recommendation: Joi.array()
    .items(
      Joi.string().custom((value, helper) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helper.message("Invalid ObjectID");
        }
        return value;
      })
    )
    .min(1)
    .messages({
      "array.min": "At least one dish is required",
    }),
});

// Function to update a dish
const updateDish = async (req, res) => {
  const { id } = req.params; // Get the dish ID from the request parameters
  const updates = req.body; // Get the updates from the request body

  const session = await mongoose.startSession();
  await session.startTransaction(); // Start the transaction immediately after creating the session
  try {
    // Validate the request body
    const { error } = updateDishSchema.validate(updates, {
      abortEarly: false,
    });

    if (error) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: error.message });
    }

    // Find the existing dish
    const dish = await DishModel.findOne({
      _id: id,
    });
    if (!dish) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Dish not found" });
    }

    // Update basic fields
    const {
      title,
      description,
      imageUrl,
      dishMrp,
      dishSalePrice,
      normalMrp,
      normalSalePrice,
      thalMrp,
      thalSalePrice,
      customizable,
      recommendation,
    } = updates;

    if (title) dish.title = title;
    if (description) dish.description = description;
    if (imageUrl) dish.imageUrl = imageUrl;
    if (dishMrp) dish.dishMrp = dishMrp;
    if (dishSalePrice) dish.dishSalePrice = dishSalePrice;
    if (normalMrp) dish.normalMrp = normalMrp;
    if (normalSalePrice) dish.normalSalePrice = normalSalePrice;
    if (thalMrp) dish.thalMrp = thalMrp;
    if (thalSalePrice) dish.thalSalePrice = thalSalePrice;
    if (customizable !== undefined) dish.customizable = customizable; // Allow false as a valid value

    // Update the customize categories only
    if (updates.customizeCategories && customizable) {
      updates.customizeCategories.forEach((updatedCategory) => {
        console.log(updatedCategory);
        const existingCategory = updatedCategory?._id
          ? dish.customizeCategories.id(updatedCategory?._id)
          : false;

        console.log(existingCategory?.title, existingCategory);

        // Validate that the updated category exists
        if (existingCategory) {
          // Update existing category fields
          existingCategory.title =
            updatedCategory.title || existingCategory.title;
          existingCategory.allowMultiple =
            updatedCategory.allowMultiple !== undefined
              ? updatedCategory.allowMultiple
              : existingCategory.allowMultiple;
          existingCategory.limit =
            updatedCategory.limit !== undefined
              ? updatedCategory.limit
              : existingCategory.limit;
          existingCategory.defaultOption =
            updatedCategory.defaultOption || existingCategory.defaultOption;

          // Update options
          updatedCategory.options.forEach((updatedOption) => {
            const existingOption = updatedOption?._id
              ? existingCategory.options.id(updatedOption?._id)
              : false;

            console.log("updatedOption----------->", updatedOption);
            console.log("updatedOption._id----------->", updatedOption._id);
            console.log("existingOption----------->", existingOption);

            if (existingOption) {
              // Update existing option fields
              existingOption.title =
                updatedOption.title || existingOption.title;
              existingOption.priceAddOn =
                updatedOption.priceAddOn !== undefined
                  ? updatedOption.priceAddOn
                  : existingOption.priceAddOn;
            } else {
              // If the option does not exist, add it
              existingCategory.options.push(updatedOption);
            }
          });
        } else {
          //   return res.status(400).json({
          //     message: `Category with ID ${updatedCategory._id} does not exist.`,
          //   })
          // throw new Error({
          //   code: 400,
          //   message: `Category with ID ${updatedCategory?._id} does not exist.`,
          // });
          dish.customizeCategories.push(updatedCategory);
        }
      });
    } else if (!customizable) {
      // If the dish is not customizable, clear the customize categories
      dish.customizeCategories = [];
    }

    console.log("Updates", updates);

    if (Array.isArray(updates.recommendation)) {
      const invalidIds = updates.recommendation.filter(
        (id) => !mongoose.Types.ObjectId.isValid(id)
      );
      if (invalidIds.length > 0) {
        throw {
          code: 400,
          message: `Invalid recommendation IDs: ${invalidIds.join(",")}`,
        };
      }
      dish.recommendation = updates.recommendation; // Replace or merge
    }

    // Save the updated dish
    await dish.save({
      session,
    });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();
    res.status(200).json({ message: "Dish updated successfully!", dish });
  } catch (error) {
    // Abort the transaction
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating dish:", error);
    res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error updating dish", error });
  }
};

// API function to soft delete a dish
const softDeleteDish = async (req, res) => {
  // Extract the dish ID from the request parameters
  const { id } = req.params;

  // Start a new Mongoose session
  const session = await mongoose.startSession();

  // Start a transaction
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    // Find the dish by ID
    const dish = await DishModel.findById(id);

    // If the dish is not found, abort the transaction and return a 404 error
    if (!dish) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Dish not found" });
    }

    const allAvailbleDish = await DishModel.find({
      recommendation: { $in: dish._id },
    }).select("_id");
    const availableDishIds = allAvailbleDish.map((dish) => dish._id.toString());
    console.log("allAvailbleDish", availableDishIds);

    await DishModel.updateMany(
      { _id: { $in: availableDishIds } }, // Find dishes with the provided _id list
      { $pull: { recommendation: dish._id } }, // Remove the created dish's _id from the `recommendation` array
      { session } // Use the current transaction session
    );

    dish.isDeleted = true;
    dish.deletedAt = Date.now();

    // Save the updated dish
    await dish.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    // End the session
    session.endSession();

    // Return a successful response
    res.status(200).json({ message: "Dish deleted successfully!" });
  } catch (error) {
    // Abort the transaction
    await session.abortTransaction();

    // End the session
    session.endSession();

    // Log the error
    console.error("Error deleting dish:", error);

    // Return an error response
    res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error deleting dish", error });
  }
};

/**
 * API function to get an Dish by ID
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<void>}
 */
const getDishById = async (req, res) => {
  const { id } = req.params;
  const session = await mongoose.startSession();
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    /**
     * Find the dish by ID
     */
    const dish = await DishModel.findOne({
      _id: id,
    }).session(session);

    /**
     * If the dish is not found, abort the transaction and return a 404 error
     */
    if (!dish) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Dish not found" });
    }

    /**
     * Commit the transaction
     */
    await session.commitTransaction();

    /**
     * End the session
     */
    session.endSession();

    /**
     * Return a successful response
     */
    res.status(200).json({ message: "Dish fetched successfully!", dish });
  } catch (error) {
    /**
     * Abort the transaction
     */
    await session.abortTransaction();

    /**
     * End the session
     */
    session.endSession();

    /**
     * Log the error
     */
    console.error("Error getting dish:", error);

    /**
     * Return an error response
     */
    res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error getting dish", error });
  }
};

// Create API endpoint to toggle the status of a dish
const toggleDishStatus = async (req, res) => {
  // Extract the dish ID from the request parameters
  const { id } = req.params;

  // Start a new Mongoose session
  const session = await mongoose.startSession();

  // Start a transaction
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    // Find the dish by ID within the session
    const dish = await DishModel.findOne({
      _id: id,
    }).session(session);

    // If the dish is not found, abort the transaction and return a 404 error
    if (!dish) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Dish not found" });
    }

    // Toggle the status of the dish
    dish.status =
      dish.status === DISH_STATUS.ACTIVE
        ? DISH_STATUS.INACTIVE
        : DISH_STATUS.ACTIVE;

    // Save the updated dish status within the session
    await dish.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    // End the session
    session.endSession();

    // Return a 200 response indicating successful update
    res
      .status(200)
      .json({ success: true, message: "Dish status updated successfully!" });
  } catch (error) {
    // Abort the transaction in case of an error
    await session.abortTransaction();

    // End the session
    session.endSession();

    // Log the error for debugging
    console.error("Error updating dish status:", error);

    // Return a 500 error response
    res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error updating dish status", error });
  }
};

// Yup schema for validation
const querySchema = yup.object().shape({
  page: yup.number().integer().min(1).default(1),
  limit: yup.number().integer().min(1).max(100).default(10),
  diet: yup
    .string()
    .oneOf([
      DISH_TYPE.VEG,
      DISH_TYPE.NON_VEG,
      DISH_TYPE.VEGAN,
      DISH_TYPE.EGGETARIAN,
      DISH_TYPE.JAIN,
    ])
    .optional(),
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

// Paginated listing API
const getDishes = async (req, res) => {
  try {
    // Validate query parameters
    const validatedQuery = await querySchema.validate(req.query, {
      abortEarly: false,
    });

    const { page, limit, sortBy, sortOrder, search, diet } = validatedQuery;

    // Build the query
    const query = {
      isDeleted: false, // Exclude soft-deleted items
    };

    // If a search term is provided, include it in the query
    if (search) {
      // Add search condition for title, description, categories, and options
      query.$or = [
        { title: { $regex: search, $options: "i" } }, // Case insensitive search in title
        { description: { $regex: search, $options: "i" } }, // Case insensitive search in description
        {
          customizeCategories: {
            $elemMatch: {
              title: { $regex: search, $options: "i" }, // Case insensitive search in category title
            },
          },
        },
        {
          customizeCategories: {
            $elemMatch: {
              options: {
                $elemMatch: {
                  title: { $regex: search, $options: "i" }, // Case insensitive search in option title
                },
              },
            },
          },
        },
      ];
    }

    // Add diet filter if provided
    if (diet) {
      query.diet = diet; // Assuming 'diet' is a field in the DishModel
    }

    // Fetch the total count of dishes matching the query
    const totalDishes = await DishModel.countDocuments(query);

    // Fetch the paginated and sorted dishes with customizeCategories count
    const dishes = await DishModel.aggregate([
      { $match: query }, // Match the query
      {
        $project: {
          imageUrl: 1,
          title: 1,
          description: 1,
          dishMrp: 1,
          dishSalePrice: 1,
          diet: 1,
          normalMrp: 1,
          normalSalePrice: 1,
          thalMrp: 1,
          thalSalePrice: 1,
          customizable: 1,
          status: 1,
          // Include the count of customizeCategories
          customizeCategoriesCount: {
            $size: { $ifNull: ["$customizeCategories", []] },
          },
        },
      },
      { $sort: { [sortBy]: sortOrder === "asc" ? 1 : -1, _id: 1 } }, // Sort by sortBy and a secondary field like _id
      { $skip: (page - 1) * limit }, // Skip the number of documents based on the page
      { $limit: limit }, // Limit the number of documents returned
    ]);

    // Return the response
    res.status(200).json({
      success: true,
      data: dishes,
      pagination: {
        total: totalDishes,
        page,
        limit,
        totalPages: Math.ceil(totalDishes / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching dishes:", error);
    res.status(400).json({
      success: false,
      message: error.errors || "Error fetching dishes",
    });
  }
};

/**
 * API function to fetch all dishes
 * @param {Object} _ - The request object (not used)
 * @param {Object} res - The response object
 * @returns {Promise<void>}
 */
const getAllDishes = async (_, res) => {
  try {
    /**
     * Find all dishes that are not soft-deleted (i.e., where isDeleted is false)
     * and select only the specified fields.
     */
    const dishes = await DishModel.find()
      .select(
        "title description diet imageUrl customizable dishMrp dishSalePrice normalMrp normalSalePrice thalMrp thalSalePrice"
      ) // Select specific fields
      .lean(); // Optional: Use lean() for better performance if you don't need Mongoose documents

    /**
     * Map the dishes to include the id field
     */
    const formattedDishes = dishes.map((dish) => ({
      id: dish._id, // Include the id field
      title: dish.title,
      description: dish.description,
      diet: dish.diet,
      imageUrl: dish.imageUrl,
      customizable: dish.customizable,
      dishMrp: dish.dishMrp,
      dishSalePrice: dish.dishSalePrice,
      normalMrp: dish.normalMrp,
      normalSalePrice: dish.normalSalePrice,
      thalMrp: dish.thalMrp,
      thalSalePrice: dish.thalSalePrice,
    }));

    /**
     * Return a successful response with the list of dishes
     */

    /**
     * Return a successful response with the list of dishes
     */
    res.status(200).json({ success: true, data: formattedDishes });
  } catch (error) {
    /**
     * Log the error for debugging
     */
    console.error("Error fetching dishes:", error);

    /**
     * Return an error response with a 400 status code
     */
    res.status(400).json({
      success: false,
      message: error.errors || "Error fetching dishes",
    });
  }
};

module.exports = {
  createDish,
  updateDish,
  softDeleteDish,
  getDishById,
  toggleDishStatus,
  getDishes,
  getAllDishes,
};
