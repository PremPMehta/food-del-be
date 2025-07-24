// Import Mongoose
const mongoose = require("mongoose");
const { USER_STATUS, USER_ROLE } = require("../../utils/constants");
const yup = require("yup");
const bcrypt = require("bcrypt");

// Import User Model
const UserModel = require("../../models/users.model");
const { verifyPassword } = require("../../utils/common");
const { SALT_ROUNDS } = require("../../config/config");

// Update user profile schema
const updateUserProfileSchema = yup.object().shape({
  name: yup.string().required(),
  email: yup.string().email().required(),
  phone: yup.string().required(),
});

const updateUserProfile = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // Start the transaction immediately after creating the session
  try {
    // Validate request body
    await updateUserProfileSchema.validate(req.body);

    const { name, email, phone } = req.body;

    const user = await UserModel.findOne({
      _id: req.user._id,
      status: USER_STATUS.ACTIVE,
    }).session(session);

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Check if the new email already exists (excluding the current user)
    if (email && email !== user.email) {
      const existingEmailUser = await UserModel.findOne({
        email: email,
      }).session(session);
      if (existingEmailUser) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ success: false, error: "Email already exists" });
      }
    }

    // Check if the new phone number already exists (excluding the current user)
    if (phone && phone !== user.phone) {
      const existingPhoneUser = await UserModel.findOne({
        phone: phone,
      }).session(session);
      if (existingPhoneUser) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ success: false, error: "Phone number already exists" });
      }
    }

    // Update the user with the new data
    user.name = name;
    user.email = email;
    user.phone = phone;

    // Save the updated user
    await user.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    const response_data = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isPrimeMember: user.isPrimeMember,
      walletBalance: user.walletBalance,
      referralCode: user.referralCode,
      role: user.role,
      status: user.status,
    };

    return res.status(200).json({
      message: "User profile updated successfully",
      data: response_data,
      success: true,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message, success: false });
  }
};

// schema for updating user password
const updateUserPasswordSchema = yup.object().shape({
  oldPassword: yup.string().required("Old password is required"),
  newPassword: yup
    .string()
    .min(6, "New Password must be at least 6 characters long")
    .required("New Password is required"),
});

const updateUserPassword = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // Start the transaction immediately after creating the session
  try {
    // Validate request body
    await updateUserPasswordSchema.validate(req.body);

    const { oldPassword, newPassword } = req.body;

    const user = await UserModel.findOne({
      _id: req.user._id,
      status: USER_STATUS.ACTIVE,
    }).session(session);

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Check if the old password is correct
    const isPasswordValid = await verifyPassword(user.password, oldPassword);
    if (!isPasswordValid) {
      await session.abortTransaction();
      session.endSession();

      return res
        .status(400)
        .json({ success: false, error: "Invalid password" });
    }

    // New hashed password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update the user's password
    user.password = hashedPassword;

    // Save the updated user
    await user.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Password updated successfully",
      success: true,
    });
    
  } catch (error) {
    // Abort the transaction
    await session.abortTransaction();
    session.endSession();

    return res.status(400).json({ message: error.message, success: false });
  }
};
module.exports = { updateUserProfile , updateUserPassword}; 
