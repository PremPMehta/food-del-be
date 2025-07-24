const UserModel = require("../../models/users.model");

const createAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { line1, line2, area, city, pincode, tag } = req.body;

    let updateAddress = await UserModel.findByIdAndUpdate(
      { _id: userId },
      {
        $push: {
          addresses: {
            line1,
            line2,
            area,
            city,
            pincode,
            tag,
          },
        },
      },
      {
        new: true,
      }
    );

    return res.status(200).json({
      message: "Address Added Successfully",
      Addresses: updateAddress.addresses,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "internal server error" });
  }
};

const updateAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { line1, line2, area, city, pincode } = req.body;

    // Update the address with the specified _id
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: userId, "addresses._id": id },
      {
        $set: {
          "addresses.$.line1": line1,
          "addresses.$.line2": line2,
          "addresses.$.area": area,
          "addresses.$.city": city,
          "addresses.$.pincode": pincode,
        },
      },
      { new: true } // Return the updated document
    );

    return res.status(200).json({
      message: "Address updated Successfully",
      Addresses: updatedUser.addresses,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "internal server error" });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: userId },
      {
        $pull: {
          addresses: { _id: id },
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User  not found" });
    }

    return res.status(200).json({
      message: "Address Deleted Successfully",
      Addresses: updatedUser.addresses,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const addressList = async (req, res) => {
  try {
    const id = req.user._id;
    const foundAddress = await UserModel.findOne({ _id: id });
    if (!foundAddress) {
      return res.status(400).json({ message: " Address Not found" });
    }

    return res.status(200).json({
      message: "Address fetch Successfully",
      Addresses: foundAddress.addresses,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
module.exports = { createAddress, updateAddress, deleteAddress, addressList };
