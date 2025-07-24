// Import the mongoose module to interact with MongoDB
const mongoose = require("mongoose");

// Import the yup module for schema validation
const yup = require("yup");

// Import the DishModel which is a mongoose model representing a dish in the database
const DishModel = require("../../models/dish.model");

// Import the CategoryModel which is a mongoose model representing a category in the database
const CategoryModel = require("../../models/category.model");

// Import CATEGORY_STATUS, a constant that defines the status values for categories
const { CATEGORY_STATUS } = require("../../utils/constants");

/**
 * Define the schema for creating a category
 *
 * @typedef {Object} createCategorySchema
 * @property {string} title - The title of the category
 * @property {string} description - The description of the category
 * @property {string} imageUrl - The URL of the category image
 * @property {string} status - The status of the category
 * @property {Array<ObjectID>} dishes - An array of ObjectID referring to the dishes
 */

const createCategorySchema = yup.object().shape({
  /**
   * The title of the category
   * @type {string}
   * @minLength 3
   * @maxLength 50
   */
  title: yup
    .string()
    .required("Title is required")
    .min(3, "Title must be at least 3 characters long")
    .max(50, "Title must be less than 50 characters long"),

  /**
   * The description of the category
   * @type {string}
   * @minLength 3
   * @maxLength 100
   */
  description: yup
    .string()
    .required("Description is required")
    .min(3, "Description must be at least 3 characters long")
    .max(100, "Description must be less than 100 characters long"),

  /**
   * The URL of the category image
   * @type {string}
   * @minLength 3
   * @maxLength 100
   */
  thumbnail: yup
    .string()
    .required("Thumbnail URL is required")
    .min(3, "Thumbnail URL must be at least 3 characters long")
    .max(100, "Thumbnail URL must be less than 100 characters long"),

  /**
   * The status of the category
   * @type {string}
   * @oneOf [CATEGORY_STATUS.ACTIVE, CATEGORY_STATUS.INACTIVE]
   * @default CATEGORY_STATUS.ACTIVE
   */
  status: yup
    .string()
    .required("Status is required")
    .oneOf([CATEGORY_STATUS.ACTIVE, CATEGORY_STATUS.INACTIVE])
    .default(CATEGORY_STATUS.ACTIVE),

  /**
   * An array of ObjectID referring to the dishes
   * @type {Array<ObjectID>}
   */
  type: yup.string().required("Category type is required.").default("thal"),
  dishes: yup
    .array()
    .of(
      yup.string().test("is-valid-objectid", "Invalid ObjectID", (value) => {
        return mongoose.Types.ObjectId.isValid(value);
      })
    )
    .min(1, "At least one dish is required"), // Ensure at least one ObjectID is present
});

/**
 * Define the schema for updating a category
 *
 * @typedef {Object} updateCategorySchema
 * @property {string} title - The title of the category
 * @property {string} description - The description of the category
 * @property {string} imageUrl - The URL of the category image
 * @property {Array<ObjectID>} dishes - An array of ObjectID referring to the dishes
 */
const createCategory = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    /**
     * Validate the request body using the createCategorySchema
     */
    const { error } = await createCategorySchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: error.message });
    }

    let foundCategory = await CategoryModel.findOne({ title: req.body.title });

    if (foundCategory) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "category already exits" });
    }

    /**
     * Create a new CategoryModel object with the validated data
     */

    const category = new CategoryModel({
      title: req.body.title,
      description: req.body.description,
      thumbnail: req.body.thumbnail,
      status: req.body.status,
      dishes: req.body.dishes,
      type: req.body.type,
    });

    /**
     * Save the category to the database
     */
    await category.save({ session });

    /**
     * Commit the transaction
     */
    await session.commitTransaction();
    session.endSession();

    /**
     * Return the created category in the response
     */
    const response = JSON.parse(JSON.stringify(category));

    response["id"] = category._id;

    delete response._id;
    delete response.__v;

    return res.status(201).json({
      message: "Category created successfully!",
      category: response,
    });
  } catch (error) {
    /**
     * Abort the transaction if any error occurs
     */
    await session.abortTransaction();
    session.endSession();
    return res.status(error.code ?? 500).json({ message: error.message });
  }
};

/**
 * Define the schema for updating a category
 *
 * @typedef {Object} updateCategorySchema
 * @property {string} title - The title of the category
 * @property {string} description - The description of the category
 * @property {string} imageUrl - The URL of the category image
 * @property {Array<ObjectID>} dishes - An array of ObjectID referring to the dishes
 */
const updateCategorySchema = yup.object().shape({
  /**
   * The title of the category
   * @type {string}
   * @minLength 3
   * @maxLength 50
   */
  title: yup
    .string()
    .min(3, "Title must be at least 3 characters long")
    .max(50, "Title must be less than 50 characters long")
    .optional(),

  /**
   * The description of the category
   * @type {string}
   * @minLength 3
   * @maxLength 100
   */
  description: yup
    .string()
    .min(3, "Description must be at least 3 characters long")
    .max(100, "Description must be less than 100 characters long")
    .optional(),

  /**
   * The URL of the category image
   * @type {string}
   * @minLength 3
   * @maxLength 100
   */
  thumbnail: yup
    .string()
    .min(3, "Thumbnail URL must be at least 3 characters long")
    .max(100, "Thumbnail URL must be less than 100 characters long")
    .optional(),

  type: yup.string().required("Category type is required.").default("thal"),
  /**
   * An array of ObjectID referring to the dishes
   * @type {Array<ObjectID>}
   */
  dishes: yup
    .array()
    .of(
      yup.string().test("is-valid-objectid", "Invalid ObjectID", (value) => {
        return mongoose.Types.ObjectId.isValid(value);
      })
    )
    .optional(),
});

/**
 * Update a category
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @returns {Promise<void>}
 */
const updateCategory = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    /**
     * Validate the request body using the updateCategorySchema
     */
    const { error } = await updateCategorySchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: error.message });
    }

    /**
     * Find the category by ID
     */
    const category = await CategoryModel.findOne({
      _id: req.params.id,
    }).session(session);

    if (!category) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Category not found" });
    }

    /**
     * Update the category with the validated data
     */
    category.title = req.body.title ?? category.title;
    category.description = req.body.description ?? category.description;
    category.thumbnail = req.body.thumbnail ?? category.thumbnail;
    category.dishes = req.body.dishes ?? category.dishes;
    category.type = req.body.type ?? category.type;

    /**
     * Save the updated category to the database
     */
    await category.save({ session });

    /**
     * Commit the transaction
     */
    await session.commitTransaction();
    session.endSession();

    /**
     * Return the updated category in the response
     */
    const response = JSON.parse(JSON.stringify(category));

    response["id"] = category._id;

    delete response._id;
    delete response.__v;

    return res.status(200).json({
      message: "Category updated successfully!",
      category: response,
    });
  } catch (error) {
    /**
     * Abort the transaction if any error occurs
     */
    await session.abortTransaction();
    session.endSession();
    return res.status(error.code ?? 500).json({ message: error.message });
  }
};

// API function to soft delete a category
// This endpoint takes a category ID as a parameter and marks the category as deleted
// This is done by setting the 'isDeleted' field to true and the 'deletedAt' field to the current timestamp
// The update is done within a transaction to ensure atomicity
const softDeleteCategory = async (req, res) => {
  // Extract the category ID from the request parameters
  const { id } = req.params;

  // Start a new Mongoose session
  const session = await mongoose.startSession();

  // Start a transaction
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    // Find the category by ID
    const category = await CategoryModel.findById(id);

    // If the category is not found, abort the transaction and return a 404 error
    if (!category) {
      // If the category is not found, abort the transaction and return a 404 error
      await session.abortTransaction();
      session.endSession();

      // Return a 404 response with a message
      return res.status(404).json({ message: "Category not found" });
    }

    // Set the 'isDeleted' field to true and the 'deletedAt' field to the current timestamp
    category.isDeleted = true;
    category.deletedAt = Date.now();

    // Save the updated category within the transaction
    await category.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    // End the session
    session.endSession();

    // Return a 200 response with a success message
    res.status(200).json({ message: "Category deleted successfully!" });
  } catch (error) {
    // Abort the transaction if any error occurs
    await session.abortTransaction();

    // End the session
    session.endSession();

    // Log the error
    console.error("Error deleting category:", error);

    // Return an error response
    res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error deleting category", error });
  }
};

// API function to get a Category by ID and remove __v field
const getCategoryById = async (req, res) => {
  // Extract the category ID from the request parameters
  const { id } = req.params;

  // Start a new Mongoose session
  const session = await mongoose.startSession();

  // Start a transaction
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    // Find the category by ID
    const category = await CategoryModel.findOne({
      _id: id,
    }).session(session);

    // If the category is not found, abort the transaction and return a 404 error
    if (!category) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Category not found" });
    }

    // Fetch the dishes associated with the category
    const dishes = await DishModel.find({
      _id: { $in: category.dishes },
      isDeleted: false, // Ensure to only fetch non-deleted dishes
    }).session(session);

    // Map the dishes to include only the required fields
    const formattedDishes = dishes.map((dish) => ({
      id: dish._id,
      imageUrl: dish.imageUrl,
      title: dish.title,
      description: dish.description,
      diet: dish.diet,
    }));

    // Remove the __v field from the category
    const response = JSON.parse(JSON.stringify(category));
    response["id"] = category._id;
    delete response._id;
    delete response.__v;
    response.dishes = formattedDishes; // Add formatted dishes to the response

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Return a 200 response with the category
    res.status(200).json({
      message: "Category found!",
      category: response,
    });
  } catch (error) {
    // Abort the transaction if any error occurs
    await session.abortTransaction();
    session.endSession();

    // Log the error
    console.error("Error getting category:", error);

    // Return an error response
    res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error getting category", error });
  }
};

// Create API endpoint to toggle the status of a category
const toggleCategoryStatus = async (req, res) => {
  // Extract the category ID from the request parameters
  const { id } = req.params;

  // Start a new Mongoose session
  const session = await mongoose.startSession();

  // Start a transaction
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    // Find the category by ID
    const category = await CategoryModel.findOne({
      _id: id,
    }).session(session);

    // If the category is not found, abort the transaction and return a 404 error
    if (!category) {
      // If the category is not found, abort the transaction and return a 404 error
      await session.abortTransaction();
      session.endSession();

      // Return a 404 response with a message
      return res.status(404).json({ message: "Category not found" });
    }

    // Toggle the status of the category
    category.status =
      category.status === CATEGORY_STATUS.ACTIVE
        ? CATEGORY_STATUS.INACTIVE
        : CATEGORY_STATUS.ACTIVE;

    // Save the updated category within the transaction
    await category.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    // End the session
    session.endSession();

    // Return a 200 response with a success message
    res.status(200).json({ message: "Category status updated successfully!" });
  } catch (error) {
    // Abort the transaction if any error occurs
    await session.abortTransaction();

    // End the session
    session.endSession();

    // Log the error
    console.error("Error updating category status:", error);

    // Return an error response
    res.status(error.code ?? 500).json({
      message: error?.message ?? "Error updating category status",
      error,
    });
  }
};

// Yup schema for validation
const querySchema = yup.object().shape({
  page: yup.number().integer().min(1).default(1),
  limit: yup.number().integer().min(1).max(100).default(10),
  sortBy: yup
    .string()
    .oneOf(["title", "createdAt", "updatedAt"], "Invalid sort field")
    .default("createdAt"),
  sortOrder: yup
    .string()
    .oneOf(["asc", "desc"], "Invalid sort order")
    .default("desc"),
  search: yup.string().optional(),
  sortType: yup.string().default(""),
});

// Paginated listing API
const getCategories = async (req, res) => {
  // const session = await mongoose.startSession();
  try {
    // Validate query parameters
    const validatedQuery = await querySchema.validate(req.query, {
      abortEarly: false,
    });

    const { page, limit, sortBy, sortOrder, search, sortType } = validatedQuery;

    // Build the query

    let query;

    if (sortType) {
      query = {
        isDeleted: false, // Exclude soft-deleted items
        type: sortType,
      };
    } else {
      query = {
        isDeleted: false, // Exclude soft-deleted items
      };
    }

    console.log("query : ", query);

    // If a search term is provided, include it in the query
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } }, // Case insensitive search in title
        { description: { $regex: search, $options: "i" } }, // Case insensitive search in description
      ];
    }

    // Fetch the total count of categories matching the query
    const totalCategories = await CategoryModel.countDocuments(query);

    // Fetch the paginated and sorted categories count
    const categories = await CategoryModel.aggregate([
      { $match: query }, // Apply the query
      {
        $project: {
          title: 1,
          description: 1,
          thumbnail: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          type: 1,
        },
      },
      { $sort: { [sortBy]: sortOrder === "asc" ? 1 : -1, _id: 1 } }, // Sort by sortBy and a secondary field like _id
      {
        $skip: (page - 1) * limit, // Skip the number of documents
      },
      {
        $limit: limit, // Limit the number of documents
      },
    ]);

    res.status(200).json({
      success: true,
      data: categories,
      pagination: {
        total: totalCategories,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalCategories / limit),
      },
    });
  } catch (error) {
    // Abort the transaction in case of an error
    // await session.abortTransaction();

    // End the session
    // session.endSession();

    // Log the error for debugging
    console.error("Error updating dish status:", error);

    // Return a 500 error response
    res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error updating dish status", error });
  }
};

/**
 * API function to fetch all categories
 * @function getCategories
 * @returns {Promise} A Promise that resolves to an array of categories
 * @throws {Error} If an error occurs while fetching categories
 */

const getAllCategories = async (_, res) => {
  try {
    /**
     * Find all categories that are not soft-deleted (i.e., where isDeleted is false)
     * and select only the specified fields.
     */

    const categories = await CategoryModel.find()
      .select("title description thumbnail status") // Select specific fields
      .lean(); // Optional: Use lean() for better performance if you don't need Mongoose documents

    if (!categories) {
      return res.status(404).json({ message: "Categories not found" });
    }

    const formattedCategories = categories.map((category) => ({
      id: category._id,
      title: category.title,
      description: category.description,
      thumbnail: category.thumbnail,
      status: category.status,
      type: category.type,
    }));

    return res
      .status(200)
      .json({ success: true, categories: formattedCategories });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error fetching categories" });
  }
};

module.exports = {
  createCategory,
  updateCategory,
  softDeleteCategory,
  getCategoryById,
  toggleCategoryStatus,
  getCategories,
  getAllCategories,
};
