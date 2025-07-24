const AdsModel = require("../../models/ads.model");

const ListAds = async (req, res) => {
  try {
    let primeValue = req.userData.isPrimeMember;
    const foundAds = await AdsModel.find({
      memberType: primeValue == true ? "prime" : "nonprime",
    });
    if (!foundAds) {
      return res.status(400).json({ message: "Ads Not Found" });
    }
    return res
      .status(200)
      .json({ message: "ads Fetched Sucessfully", foundAds });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.errors || error.message,
    });
  }
};
const getAdsById = async (req, res) => {
  try {
    const { id } = req.params.id;
    const foundAds = await AdsModel.find({ _id: id });
    if (!foundAds) {
      return res.status(400).json({ message: "Ads Not Found" });
    }
    return res
      .status(200)
      .json({ message: "ads Fetched Sucessfully", foundAds });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.errors || error.message,
    });
  }
};

module.exports = { ListAds, getAdsById };
