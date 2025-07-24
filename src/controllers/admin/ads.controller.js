const Yup = require("yup");
const AdsModel = require("../../models/ads.model");

const AdsSchema = Yup.object().shape({
  thumbnail: Yup.string()
    .url("Thumbnail must be a valid URL")
    .required("Thumbnail is required"),

  visibility: Yup.string()
    .oneOf(
      ["private", "public"],
      "Visibility must be one of: public, private, or restricted"
    )
    .required("Visibility is required"),

  memberType: Yup.string()
    .oneOf(["prime", "nonprime"], "Member type must be one of: prime, nonprime")
    .required("Member type is required"),

  link: Yup.string().required("Link is required"),
});

const querySchema = Yup.object().shape({
  page: Yup.number().integer().min(1).default(1),
  limit: Yup.number().integer().min(1).max(100).default(10),
  sortBy: Yup.string()
    .oneOf(["createdAt", "updatedAt"], "Invalid sort field")
    .default("createdAt"),
  sortOrder: Yup.string()
    .oneOf(["asc", "desc"], "Invalid sort order")
    .default("desc"),
  search: Yup.string().optional(),
});

const listAds = async (req, res) => {
  try {
    const validatedQuery = await querySchema.validate(req.query, {
      abortEarly: false,
    });

    const { page, limit, sortBy, sortOrder, search } = validatedQuery;
    const query = {};
    if (search) {
      query.$or = [{ visibility: { $regex: search, $options: "i" } }];
    }
    const totalAds = await AdsModel.countDocuments(query);

    const adsData = await AdsModel.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ [sortBy]: sortOrder });

    const listAds = await AdsModel.find();
    if (!listAds) {
      return res.status(400).json({ message: "No any ads found" });
    }
    return res.status(200).json({
      message: "ads fetch Successfully",
      data: adsData,
      pagination: {
        total: totalAds,
        page,
        limit,
        totalPages: Math.ceil(totalAds / limit),
      },
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.errors || error.message,
    });
  }
};
const createAds = async (req, res) => {
  try {
    const validate = await AdsSchema.validate(req.body);
    const { thumbnail, visibility, memberType, link } = req.body;

    const newAds = new AdsModel({
      thumbnail,
      visibility,
      memberType,
      link,
    });

    let AddedAds = await newAds.save();

    return res
      .status(200)
      .json({ message: "ads Added Successfully", data: AddedAds });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.errors || error.message,
    });
  }
};

const updateAds = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ message: "Id is Required" });
    }
    const founded = await AdsModel.findOne({ _id: id });
    if (!founded) {
      return res.status(400).json({ message: "data not found on this id" });
    }
    const updatedAds = await AdsModel.findByIdAndUpdate({ _id: id }, req.body, {
      new: true,
    });
    return res
      .status(200)
      .json({ message: "ads Updated Sucessfully", data: updatedAds });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.errors || error.message,
    });
  }
};
const removeAds = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ message: "Id is Required" });
    }
    await AdsModel.findByIdAndDelete({ _id: id });
    return res.status(200).json({ message: "ads Delete Sucessfully" });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  listAds,
  createAds,
  updateAds,
  removeAds,
};
