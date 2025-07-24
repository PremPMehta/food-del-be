// Import the mongoose module to interact with MongoDB
const mongoose = require("mongoose");

// Import the yup module for schema validation
const yup = require("yup");

// Import the ThalModel which is a mongoose model representing a thal in the database
const ThalModel = require("../../models/thal.model");

// Import the CategoryModel which is a mongoose model representing a category in the database
const CategoryModel = require("../../models/category.model");

// Import the DishModel which is a mongoose model representing a dish in the database
const DishModel = require("../../models/dish.model");
const ComboModel = require("../../models/combo.model");

// API to get first thal category and details of it

const startThalCategory = async (req, res) => {
  try {
    // Step 1: Find the Thal and retrieve only the categories
    const thal = await ThalModel.findOne(
      {}, // You can adjust this query if you need specific Thal
      { categories: 1 } // Only return the categories field
    );
    console.log("thal-->", thal);
    if (!thal || thal.categories.length === 0) {
      return res.status(404).json({ error: "No categories found" });
    }

    // Step 2: Find the category with order 1
    // const categoryOrder = thal.categories.find((cat) => cat.order === 1 );
    const categoryOrder = thal.categories.find((cat) => cat.order >= 1);

    if (!categoryOrder) {
      return res.status(404).json({ error: "Category with order 1 not found" });
    }

    // Step 3: Query the CategoryModel for its details
    // const categoryDetails = await CategoryModel.findById(
    //   categoryOrder.category
    // ).populate({
    //   path: "dishes",
    //   model: DishModel,
    // });

    const categoryDetails = await CategoryModel.findById(
      categoryOrder.category
    ).populate({
      path: "dishes", // The field in CategoryModel that references DishModel
      model: DishModel, // The model to populate with
      populate: {
        path: "recommendation", // If you need to populate references inside dishes
        model: DishModel, // Populate recommendation references with DishModel
      },
    });

    // give recommedation combo meal

    let foundCombos = await ComboModel.find({
      displayCategory: categoryDetails._id,
      isDeleted: false,
    }).populate("dishes");

    let comboMeal = foundCombos.map((item) => ({
      title: item.title,
      description: item.description,
      thumbnail: item.thumbnail,
      amount: item.amount,
      diet: item.diet,
      dishes: item.dishes,
    }));

    if (!categoryDetails || categoryDetails.status !== "active") {
      return res.status(404).json({ error: "Category is not active" });
    }

    // Prepare the response without _id, __v, isDeleted, deletedAt
    const responseCategory = {
      _id: categoryDetails._id,
      title: categoryDetails.title,
      description: categoryDetails.description,
      thumbnail: categoryDetails.thumbnail,
      status: categoryDetails.status,
      dishes: categoryDetails.dishes,
      combos: comboMeal,
      createdAt: categoryDetails.createdAt,
      updatedAt: categoryDetails.updatedAt,
      orderId: categoryOrder.order,
      recommendation: categoryOrder.recommendation,
    };

    return res.status(200).json({ category: responseCategory });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const nextThalCategory = async (req, res) => {
  const { orderId } = req.params;

  try {
    // Step 1: Find the Thal and retrieve only the categories
    const thal = await ThalModel.findOne(
      {}, // You can adjust this query if you need specific Thal
      { categories: 1 } // Only return the categories field
    );

    if (!thal || thal.categories.length === 0) {
      return res.status(404).json({ error: "No categories found" });
    }

    // Step 2: Find the category with order 1
    const categoryOrder = thal.categories.find(
      (cat) => cat.order === +orderId + 1
    );

    if (!categoryOrder) {
      // sort the category in reverse order and check if the order id is current then return that categories ended
      const sortedCategories = thal.categories.sort(
        (a, b) => b.order - a.order
      );
      const lastCategoryOrder = sortedCategories[0].order;

      if (lastCategoryOrder === +orderId) {
        return res
          .status(200)
          .json({ error: "No next category found", currentLastCategory: true });
      }
      return res.status(404).json({ error: "Category with order not found" });
    }

    // Step 3: Query the CategoryModel for its details
    const categoryDetails = await CategoryModel.findById(
      categoryOrder.category
    ).populate({
      path: "dishes",
      model: DishModel,
      populate: {
        path: "recommendation", // If you need to populate references inside dishes
        model: DishModel, // Populate recommendation references with DishModel
      },
    });

    // Check if the category is active
    if (!categoryDetails || categoryDetails.status !== "active") {
      return res.status(404).json({ error: "Category is not active" });
    }

    // Prepare the response without _id, __v, isDeleted, deletedAt
    const responseCategory = {
      _id: categoryDetails._id,
      title: categoryDetails.title,
      description: categoryDetails.description,
      thumbnail: categoryDetails.thumbnail,
      status: categoryDetails.status,
      dishes: categoryDetails.dishes,
      createdAt: categoryDetails.createdAt,
      updatedAt: categoryDetails.updatedAt,
      orderId: categoryOrder.order,
      recommendation: categoryOrder.recommendation,
    };

    return res.status(200).json({ category: responseCategory });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const previousThalCategory = async (req, res) => {
  const { orderId } = req.params;

  if (+orderId === 1) {
    return res.status(200).json({ error: "No previous category found" });
  }

  try {
    // Step 1: Find the Thal and retrieve only the categories
    const thal = await ThalModel.findOne(
      {}, // You can adjust this query if you need specific Thal
      { categories: 1 } // Only return the categories field
    );

    if (!thal || thal.categories.length === 0) {
      return res.status(404).json({ error: "No categories found" });
    }

    // Step 2: Find the category with the previous order
    const categoryOrder = thal.categories.find(
      (cat) => cat.order === +orderId - 1
    );

    if (!categoryOrder) {
      // Sort the categories in ascending order and check if the order id is current then return that categories ended
      const sortedCategories = thal.categories.sort(
        (a, b) => a.order - b.order
      );
      const firstCategoryOrder = sortedCategories[0].order;

      if (firstCategoryOrder === +orderId) {
        return res.status(200).json({ error: "No previous category found" });
      }
      return res.status(404).json({ error: "Category with order not found" });
    }

    // Step 3: Query the CategoryModel for its details
    const categoryDetails = await CategoryModel.findById(
      categoryOrder.category
    ).populate({
      path: "dishes",
      model: DishModel,
      populate: {
        path: "recommendation", // If you need to populate references inside dishes
        model: DishModel, // Populate recommendation references with DishModel
      },
    });

    // Check if the category is active
    if (!categoryDetails || categoryDetails.status !== "active") {
      return res.status(404).json({ error: "Category is not active" });
    }

    // Prepare the response without _id, __v, isDeleted, deletedAt
    const responseCategory = {
      _id: categoryDetails._id,
      title: categoryDetails.title,
      description: categoryDetails.description,
      thumbnail: categoryDetails.thumbnail,
      status: categoryDetails.status,
      dishes: categoryDetails.dishes,
      orderId: categoryOrder.order,
      recommendation: categoryOrder.recommendation,
    };

    return res.status(200).json({ category: responseCategory });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// api function to get thal category by order id
const getThalCategoryById = async (req, res) => {
  const { orderId } = req.params;

  if (+orderId < 1) {
    return res.status(400).json({ error: "Invalid order id" });
  }

  console.log("orderId", +orderId);

  try {
    // Step 1: Find the Thal and retrieve only the categories
    const thal = await ThalModel.findOne(
      {}, // You can adjust this query if you need specific Thal
      { categories: 1 } // Only return the categories field
    );

    if (!thal || thal.categories.length === 0) {
      return res.status(404).json({ error: "No categories found" });
    }

    // Step 2: Find the category with the previous order
    const categoryOrder = thal.categories.find((cat) => cat.order === +orderId);

    if (!categoryOrder) {
      return res.status(404).json({ error: "Category with order not found" });
    }

    // Step 3: Query the CategoryModel for its details
    const categoryDetails = await CategoryModel.findById(
      categoryOrder.category
    ).populate({
      path: "dishes",
      model: DishModel,
      populate: {
        path: "recommendation", // If you need to populate references inside dishes
        model: DishModel, // Populate recommendation references with DishModel
      },
    });

    // Check if the category is active
    if (!categoryDetails || categoryDetails.status !== "active") {
      return res.status(404).json({ error: "Category is not active" });
    }

    // Prepare the response without _id, __v, isDeleted, deletedAt
    const responseCategory = {
      _id: categoryDetails._id,
      title: categoryDetails.title,
      description: categoryDetails.description,
      thumbnail: categoryDetails.thumbnail,
      status: categoryDetails.status,
      dishes: categoryDetails.dishes,
      orderId: categoryOrder.order,
      recommendation: categoryOrder.recommendation,
    };

    return res.status(200).json({ category: responseCategory });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  startThalCategory,
  nextThalCategory,
  previousThalCategory,
  getThalCategoryById,
};
