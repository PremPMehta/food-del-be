let axios = require("axios");
const { LOCATION_KEY } = require("../../config/config");
const locationData = async (req, res) => {
  try {
    const { lng, lat } = req.body;
    let foundLocation = await axios.get(
      `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${LOCATION_KEY}`
    );
    if (!foundLocation) {
      res.status(400).json({ message: "loaction not found" });
    }

    console.log(" foundLocation.data :", JSON.stringify(foundLocation.data));
    let response = foundLocation.data?.features?.map((item) => ({
      locality: item?.properties?.county,
      pincode: item?.properties?.postcode,
    }));

    return res
      .status(200)
      .json({ message: "Loaction fetched successfully", response });
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
};

module.exports = { locationData };
