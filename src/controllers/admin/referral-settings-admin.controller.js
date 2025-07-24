// Import the mongoose module to interact with MongoDB
const mongoose = require("mongoose");

// Import the yup module for schema validation
const yup = require("yup");

// Import the RefferalSettingsModel which is a mongoose model representing a refferal settings in the database
const ReferralSettingsModel = require("../../models/referral-settings.model");

const UserModel = require("../../models/users.model");
const { TRANSACTION_TYPE } = require("../../utils/constants");

const createUpdateReferralSettingsSchema = yup.object().shape({
  // Level of referral, must be an integer between 1 and 3
  level: yup
    .number()
    .integer()
    .min(1, "Level must be at least 1") // Minimum level is 1
    .max(3, "Level must be at most 3") // Maximum level is 3
    .required("Level is required"), // This field is required

  // Signup bonus settings
  membershipBonus: yup
    .object()
    .shape({
      // Percentage of signup bonus, must be an integer between 0 and 100
      percentage: yup
        .number()
        .integer()
        .min(0, "Percentage must be at least 0") // Minimum percentage is 0
        .max(100, "Percentage must be at most 100") // Maximum percentage is 100
        .required("Membership bonus percentage is required"), // This field is required

      // Maximum bonus amount, must be an integer and at least 0
      maxBonus: yup
        .number()
        .integer()
        .min(0, "Max bonus must be at least 0") // Minimum maxBonus is 0
        .required("Max bonus is required"), // This field is required
    })
    .required("Membership bonus settings are required"), // This field is required

  // Top-up bonus settings
  topUpBonus: yup
    .object()
    .shape({
      // Percentage of top-up bonus, must be an integer between 0 and 100
      percentage: yup
        .number()
        .integer()
        .min(0, "Percentage must be at least 0") // Minimum percentage is 0
        .max(100, "Percentage must be at most 100") // Maximum percentage is 100
        .required("Top-up bonus percentage is required"), // This field is required

      // Maximum amount for top-up bonus, must be an integer and at least 0
      maxBonus: yup
        .number()
        .integer()
        .min(0, "Max amount must be at least 0") // Minimum maxBonus is 0
        .required("Max amount is required"), // This field is required
    })
    .required("Top-up bonus settings are required"), // This field is required
});

const createUpdateReferralSettings = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    /**
     * Validate the request body using the createUpdateReferralSettingsSchema
     */

    const { error } = await createUpdateReferralSettingsSchema.validate(
      req.body,
      {
        abortEarly: false,
      }
    );

    if (error) {
      /**
       * Abort the transaction and end the session
       */
      await session.abortTransaction();
      session.endSession();

      return res.status(400).json({
        message: error.message,
      });
    }

    /**
     * Create or update the ReferralSettingsModel object with the validated data
     */
    const { level, membershipBonus, topUpBonus } = req.body;

    const referralSettings = await ReferralSettingsModel.findOneAndUpdate(
      { level: level }, // Find the document with the specified level
      {
        membershipBonus,
        topUpBonus,
      },
      {
        new: true, // Return the updated document
        upsert: true, // Create a new document if it doesn't exist
        session, // Use the session for transaction
      }
    );

    /**
     * Commit the transaction and end the session
     */
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Referral settings created or updated successfully",
      referralSettings,
    });
  } catch (error) {
    /**
     * Abort the transaction and end the session
     */
    await session.abortTransaction();
    session.endSession();

    return res.status(error.status ?? 500).json({
      message: error?.code ?? error?.message ?? "Internal server error",
      error,
    });
  }
};

/**
 * API to list all referral settings
 *
 * This API lists all referral settings in the database.
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 *
 * @returns {Object} - Returns an object with a message and an array of referral settings objects
 *
 */
const getAllReferralSettings = async (req, res) => {
  try {
    // Use the find method to fetch all referral settings from the database
    // The select method is used to exclude the __v field from the result
    const referralSettings = await ReferralSettingsModel.find().select("-__v");

    // Return the response object with a 200 status code
    // The response object contains the message and an array of referral settings objects
    return res.status(200).json({
      // Message to indicate that the referral settings were fetched successfully
      message: "Referral settings fetched successfully",
      // The referralSettings array contains the fetched referral settings objects
      referralSettings,
    });
  } catch (error) {
    // Catch any errors that occur during the execution of the above code
    // Return the response object with the error status code
    // The response object contains the message and the error object
    return res.status(error.status ?? 500).json({
      // Message to indicate that an error occurred
      message: error?.code ?? error?.message ?? "Internal server error",
      // The error object contains the details of the error
      error,
    });
  }
};

const allUSer = async (req, res) => {
  try {
    const { page, limit, sortBy, sortOrder, search } = req.query;

    const query = {};
    if (search) {
      query.$or = [{ name: { $regex: search, $options: "i" } }];
    }

    const userData = await UserModel.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ [sortBy]: sortOrder });

    if (!userData) {
      return res.status(400).json({
        success: false,
        message: "USer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "USer fetch successfully",
      data: userData,
    });
  } catch (error) {
    return res.status(error.status ?? 500).json({
      message: error?.code ?? error?.message ?? "Internal server error",
      error,
    });
  }
};

const provideDirectReferralBonus = async (req, res) => {
  try {
    const AdminData = req.user;
    const { user_id, amount } = req.body;

    const userData = await UserModel.find({ _id: user_id });

    if (!userData) {
      return res.status(400).json({
        success: false,
        message: "USer not found",
      });
    }

    const referrerPaymentHistoryPayload = {
      payment_id: "",
      reference_id: "",
      amount: parseFloat(amount),
      transaction_id: "",
      starting_balance: userData.walletBalance,
      transaction_type: TRANSACTION_TYPE.CREDIT,
      closing_balance: userData.walletBalance + parseFloat(amount),
      description:`Referral bonus provided by admin ${AdminData.name} for referring your friends. Rewarded amount: ${amount}.`
    };

    userData.paymentHistory.unshift(referrerPaymentHistoryPayload);

    // update the parent user wallet
    userData.walletBalance += parseFloat(amount);

    userData.save();

    return res.status(200).json({
      success: true,
      message: "Admin reward credited successfully",
      data: {
        amount: amount,
      },
    });
  } catch (error) {
    return res.status(error.status ?? 500).json({
      message: error?.code ?? error?.message ?? "Internal server error",
      error,
    });
  }
};
module.exports = {
  createUpdateReferralSettings,
  getAllReferralSettings,
  provideDirectReferralBonus,
  allUSer,
};
