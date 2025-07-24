// Import the mongoose module to interact with MongoDB
const mongoose = require("mongoose");

// Import the yup module for schema validation
const yup = require("yup");

// IMport the ThalModel which is a mongoose model representing a thal in the database
const ThalModel = require("../../models/thal.model");

// Import the CategoryModel which is a mongoose model representing a category in the database
const CategoryModel = require("../../models/category.model");

// create me an api function for post thal api to set the order of categories
const setThalOrderSchema = yup.object().shape({
  categories: yup.array().of(
    yup.object().shape({
      category: yup
        .string()
        .test("is-valid-objectid", "Invalid ObjectID", (value) => {
          return mongoose.Types.ObjectId.isValid(value);
        }),
      order: yup.number().required("Order is required"),
    })
  ),
});

const setThalOrder = async (req, res) => {
  try {
    const { categories } = req.body;

    // Validate the request body
    const { error } = await setThalOrderSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    // Update the order of categories in the database
    // thal model call to update thal record or create one if not exist
    const updatedThal = await ThalModel.findOneAndUpdate(
      {},
      { categories },
      { upsert: true, new: true }
    );

    // Update the order of categories in the database
    console.log("updatedThal :>> ", updatedThal);

    // Return a success response
    return res.status(200).json({ message: "Thal order updated successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const getThalOrder = async (req, res) => {
  try {
    // Find the thal record in the database
    const thal = await ThalModel.findOne({}).lean(); // Use lean() to get plain JavaScript object

    if (!thal) {
      return res.status(404).json({ message: "Thal not found" });
    }

    // Remove __v and _id fields
    const { _id, __v, ...thalWithoutIdAndVersion } = thal;

    // Return the order of categories
    return res.status(200).json({
      message: "Thal order fetched successfully",
      thal: thalWithoutIdAndVersion.categories,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};
module.exports = {
  setThalOrder,
  getThalOrder
};
