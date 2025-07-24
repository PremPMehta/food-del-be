// Import the mongoose module to interact with MongoDB
const mongoose = require("mongoose");

// Import the CategoryModel which is a mongoose model representing a category in the database
const CategoryModel = require("../../models/category.model");

// Import the DishModel which is a mongoose model representing a dish in the database
const DishModel = require("../../models/dish.model");
const ComboModel = require("../../models/combo.model");
const FastFoodOrder = require("../../models/fastfood-order.model");

// API to get first thal category and details of it

const getFastfoods = async (req, res) => {
  try {
    const fastfoodDetails = await CategoryModel.find({
      type: "fastfood",
    });

    // Check if the category is active
    if (!fastfoodDetails) {
      return res.status(404).json({ error: "Not found fastfood Category" });
    }

    let foundCombos = await ComboModel.find({
      displayCategory: { $in: fastfoodDetails.map((detail) => detail._id) },
      isDeleted: false,
    });

    let comboMeal = foundCombos.map((item) => ({
      title: item.title,
      description: item.description,
      thumbnail: item.thumbnail,
      amount: item.amount,
      diet: item.diet,
      dishes: item.dishes,
    }));

    // Prepare the response without _id, __v, isDeleted, deletedAt
    const responseCategory = fastfoodDetails.map((item) => ({
      _id: item._id,
      title: item.title,
      description: item.description,
      thumbnail: item.thumbnail,
      status: item.status,
      dishes: item.dishes,
      combos: comboMeal,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      type: item.type,
    }));

    return res.status(200).json({ category: responseCategory });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const getVegFastfoods = async (req, res) => {
  try {
    const categoriesWithVegDishes = await CategoryModel.aggregate([
      [
        {
          $lookup: {
            from: "dishes", // Name of the Dish collection
            localField: "dishes",
            foreignField: "_id",
            as: "dishesData",
          },
        },
        {
          $match: {
            $and: [
              { "dishesData.diet": "Veg" }, // Replace "Veg" with your constant or value for VEG
              { type: "fastfood" }, // Add the condition for type
            ],
          },
        },
        {
          $project: {
            title: 1,
            description: 1,
            dishesData: 1,
            thumbnail: 1,
            status: 1,
            type: 1,
          },
        },
      ],
    ]);

    // Check if the category is active
    if (!categoriesWithVegDishes || categoriesWithVegDishes.length === 0) {
      return res.status(404).json({ error: "Not found veg fastfood Category" });
    }

    // Prepare the response without _id, __v, isDeleted, deletedAt
    const responseCategory = categoriesWithVegDishes.map((item) => ({
      _id: item._id,
      title: item.title,
      description: item.description,
      thumbnail: item.thumbnail,
      status: item.status,
      dishes: item.dishesData,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      type: item.type,
    }));

    return res.status(200).json({ category: responseCategory });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const getFastfoodsDish = async (req, res) => {
  try {
    const categoryId = req.params.id;

    let categoryDetails = await CategoryModel.findById(categoryId).populate({
      path: "dishes", // Populate the dishes field
      model: "Dish",
      populate: {
        path: "recommendation", // Populate the recommendation field in each dish
        model: "Dish", // Specify the model to populate
      },
    });

    // Create a Set to store unique dish IDs
    const uniqueDishIds = new Set();

    // Create a mapping of dish IDs to category details
    const dishMapping = {};

    // Populate the mapping with category details
    categoryDetails.dishes.forEach((dish) => {
      dishMapping[dish._id.toString()] = {
        categoryId: categoryDetails._id,
        categoryTitle: categoryDetails.title,
        categoryDescription: categoryDetails.description,
        categoryThumbnail: categoryDetails.thumbnail,
      };

      if (dish.recommendation && Array.isArray(dish.recommendation)) {
        dish.recommendation.forEach((recId) => {
          uniqueDishIds.add(recId?._id?.toString()); // Add each recommendation ID to the Set
        });
      }
    });

    // Convert the Set back to an array if needed
    const uniqueDishIdArray = Array.from(uniqueDishIds);

    const otherCategoryDishes = uniqueDishIdArray?.filter(
      (record) => !dishMapping[record]
    );

    // Fetch categories for the dishes in otherCategoryDishes
    const otherCategories = await CategoryModel.find({
      dishes: { $in: otherCategoryDishes },
    }).exec();

    otherCategories.forEach((category) => {
      category.dishes.forEach((dish) => {
        const dishId = dish?._id?.toString();

        if (otherCategoryDishes?.includes(dishId)) {
          dishMapping[dishId] = {
            categoryId: category._id,
            categoryTitle: category.title,
            categoryDescription: category.description,
            categoryThumbnail: category.thumbnail,
          };
        }
      });
    });

    // Iterate through the dishes again to add category details to recommendations
    let categoryDetailsJSON = categoryDetails?.toJSON();

    categoryDetailsJSON.dishes = categoryDetailsJSON.dishes.map((dish) => {
      let dishRecommendations = dish.recommendation;

      if (dishRecommendations && dishRecommendations?.length > 0) {
        dishRecommendations = dishRecommendations?.map((rec) => {
          const recId = rec._id.toString();
          if (dishMapping[recId]) {
            // If the recommendation ID exists in the dish mapping, add category details
            rec.categoryId = dishMapping[recId].categoryId?.toString();
            rec.categoryTitle = dishMapping[recId].categoryTitle;
            rec.categoryDescription = dishMapping[recId].categoryDescription;
            rec.categoryThumbnail = dishMapping[recId].categoryThumbnail;
          }

          return rec;
        });
      }
      return dish;
    });

    const combos = await ComboModel.find({
      displayCategory: categoryId,
      isDeleted: false, // Ensure we only get non-deleted combos
    }).populate("dishes");

    // Now, you can format the response as needed
    const formattedResponse = {
      _id: categoryDetailsJSON._id,
      title: categoryDetailsJSON.title,
      description: categoryDetailsJSON.description,
      thumbnail: categoryDetailsJSON.thumbnail,
      status: categoryDetailsJSON.status,
      isDeleted: categoryDetailsJSON.isDeleted,
      deletedAt: categoryDetailsJSON.deletedAt,
      type: categoryDetailsJSON.type,
      createdAt: categoryDetailsJSON.createdAt,
      updatedAt: categoryDetailsJSON.updatedAt,
      dishes: categoryDetailsJSON.dishes,
      combos: combos,
    };

    // give recommedation combo meal

    // let foundCombos = await ComboModel.find({
    //   displayCategory: { $in: dishDetails.map((detail) => detail._id) },
    //   // isDeleted: false,
    // }).populate("dishes");

    // console.log("foundCombos", foundCombos);
    // let comboMeal = foundCombos.map((item) => ({
    //   title: item.title,
    //   description: item.description,
    //   thumbnail: item.thumbnail,
    //   amount: item.amount,
    //   diet: item.diet,
    //   dishes: item.dishes,
    // }));

    return res.status(200).json({ category: formattedResponse });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const popularFastFood = async (req,res) => {
  try {
    const popularFastFood = await FastFoodOrder.aggregate([
      { $unwind: "$items" },
      { $unwind: "$items.items" },

      {
        $group: {
          _id: "$items.items.dish", // or use "title" if IDs can repeat
          totalQuantity: { $sum: "$items.items.quantity" },
          itemObject: { $first: "$items.items" },
        },
      },

      { $sort: { totalQuantity: -1 } },
      { $limit: 4 },
      { $replaceWith: "$itemObject" },
    ]);

    if (!popularFastFood) {
      return res.status(404).json({ error: "Not found  popular fastFood" });
    }

    return res
      .status(200)
      .json({
        success: true,
        message: "Popular fastFood fetch successfully",
        data: popularFastFood,
      });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
module.exports = {
  getFastfoods,
  getFastfoodsDish,
  getVegFastfoods,
  popularFastFood
};
