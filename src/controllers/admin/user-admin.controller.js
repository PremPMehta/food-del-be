// The following line imports the mongoose module which is used to interact with MongoDB
const mongoose = require("mongoose");

// The following line imports the Yup module which is used for validation
const yup = require("yup");

// The following line imports the UserModel which is a mongoose model that represents a user in the database
const UserModel = require("../../models/users.model");

// The following line imports the AdminUserModel which is a mongoose model that represents a user in the database
const AdminUserModel = require("../../models/users-admin.model");

// The following line imports the TransactionModel which is a mongoose model that represents a transaction in the database
const TransactionModel = require("../../models/transaction.model");

const {
  USER_STATUS,
  TRANSACTION_TYPE,
  PAYMENT_METHOD,
  TRANSACTION_STATUS,
} = require("../../utils/constants");
const { ref } = require("joi");
const { verifyPassword } = require("../../utils/common");
const { PRIME_MEMBERSHIP_AMOUNT } = require("../../config/config");

// Yup schema for validation
const querySchema = yup.object().shape({
  page: yup.number().integer().min(1).default(1),
  limit: yup.number().integer().min(1).max(100).default(10),
  sortBy: yup
    .string()
    .oneOf(
      ["name", "email", "phone", "status", "updatedAt", "createdAt"],
      "Invalid sort field"
    )
    .default("createdAt"),
  sortOrder: yup
    .string()
    .oneOf(["asc", "desc"], "Invalid sort order")
    .default("desc"),
  search: yup.string().optional(),
});

// Paginated listing API
const getUsers = async (req, res) => {
  try {
    // Validate query parameters
    const validatedQuery = await querySchema.validate(req.query, {
      abortEarly: false,
    });

    const { page, limit, sortBy, sortOrder, search } = validatedQuery;

    // Build the query
    const query = {
      isDeleted: false, // Exclude soft-deleted items
    };

    // If a search term is provided, include it in the query
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } }, // Case insensitive search in name
        { email: { $regex: search, $options: "i" } }, // Case insensitive search in email
        { phone: { $regex: search, $options: "i" } }, // Case insensitive search in phone
      ];
    }

    // Fetch the total count of users matching the query
    const totalUsers = await UserModel.countDocuments(query);

    // Fetch the paginated and sorted users count
    // Fetch the total count of users matching the query
    // and the paginated and sorted users
    const users = await UserModel.aggregate([
      // Apply the query
      { $match: query },
      // Select the fields we want to return
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          phone: 1,
          status: 1,
          isPrimeMember: 1,
          walletBalance: 1,
          createdAt: 1,
          updatedAt: 1,
          referralCode: 1,
        },
      },
      // Use $facet to return two arrays: metadata and data
      // metadata contains the total count of users
      // data contains the paginated and sorted users
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        },
      },
      // Unwind the metadata array
      { $unwind: "$metadata" },
      // Unwind the data array
      { $unwind: "$data" },
      // Replace the root document with the data
      { $replaceRoot: { newRoot: "$data" } },
      // Sort the data
      { $sort: { [sortBy]: sortOrder === "asc" ? 1 : -1, _id: 1 } }, // Sort by sortBy and a secondary field like _id
    ]);

    // Return the response
    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total: totalUsers,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalUsers / limit),
      },
    });
  } catch (error) {
    // Abort the transaction
    await session.abortTransaction();

    // End the session
    session.endSession();

    // Return an error
    return res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error listing users", error });
  }
};

const toggleUserStatusSchema = yup.object().shape({
  password: yup.string().required("Password is required"),
});
// Create API endpoint to toggle the status of a user
const toggleUserStatus = async (req, res) => {
  // Extract the user ID from the request parameters
  const { id } = req.params;

  // Start a new Mongoose session
  const session = await mongoose.startSession();

  // Start a transaction
  await session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    await toggleUserStatusSchema.validate(req.body);

    const adminId = req.user._id;

    // Find the admin user by ID within the session
    const admin = await AdminUserModel.findOne({
      _id: adminId,
    }).session(session);

    if (!admin) {
      // If the admin user is not found, abort the transaction and return a 404 error
      await session.abortTransaction();

      // End the session
      session.endSession();

      // If the admin user is not found, return an error
      return res.status(404).json({ error: "Admin user not found" });
    }

    // get the password field

    const { password } = req.body;

    // Verify password
    const isValid = await verifyPassword(admin.password, password);

    // If password is not valid
    if (!isValid) {
      // If the password is not valid, abort the transaction and return a 400 error
      await session.abortTransaction();

      // End the session
      session.endSession();

      // If the password is not valid, return an error
      return res.status(400).json({ error: "Invalid password" });
    }

    // Find the user by ID within the session
    const user = await UserModel.findOne({
      _id: id,
    }).session(session);

    if (!user) {
      // If the user is not found, abort the transaction and return a 404 error
      await session.abortTransaction();

      // End the session
      session.endSession();

      // If the user is not found, return an error
      return res.status(404).json({ error: "User not found" });
    }

    // Toggle the status of the user
    user.status =
      user.status === USER_STATUS.ACTIVE
        ? USER_STATUS.INACTIVE
        : USER_STATUS.ACTIVE;

    // Save the updated user within the session
    await user.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    // End the session
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
      paymentHistory: user.paymentHistory,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Return the updated user
    return res.status(200).json({
      success: true,
      data: response_data,
      message: "User status updated",
    });
  } catch (error) {
    // Abort the transaction
    await session.abortTransaction();

    // End the session
    session.endSession();

    console.log(JSON.stringify(error));
    // Return an error
    return res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error updating user status", error });
  }
};

/**
 * API function to get an User by ID
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<void>}
 */
const getUserById = async (req, res) => {
  // Extract the user ID from the request parameters
  const { id } = req.params;

  // Start a new Mongoose session
  const session = await mongoose.startSession();

  // Start a transaction
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    // Find the user by ID within the session
    const user = await UserModel.findOne({
      _id: id,
    }).session(session);

    // If the user is not found, abort the transaction and return a 404 error
    if (!user) {
      // Abort the transaction
      await session.abortTransaction();

      // End the session
      session.endSession();

      // Return an error
      return res.status(404).json({ message: "User not found" });
    }

    // Commit the transaction
    await session.commitTransaction();

    // End the session
    session.endSession();

    const response = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isPrimeMember: user.isPrimeMember,
      walletBalance: user.walletBalance,
      referralCode: user.referralCode,
      role: user.role,
      status: user.status,
      paymentHistory: user.paymentHistory,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Return the user
    return res.status(200).json({
      success: true,
      message: "User fetched successfully.",
      data: response,
    });
  } catch (error) {
    // Abort the transaction
    await session.abortTransaction();

    // End the session
    session.endSession();

    // Return an error
    return res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error getting dish", error });
  }
};

const softDeleteUserSchema = yup.object().shape({
  password: yup.string().required("Password is required"),
});
// API function to soft delete a user
const softDeleteUser = async (req, res) => {
  // Extract the user ID from the request parameters
  const { id } = req.params;

  // Start a new Mongoose session
  const session = await mongoose.startSession();

  // Start a transaction
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    await softDeleteUserSchema.validate(req.body);

    const adminId = req.user._id;

    // Find the admin user by ID within the session
    const adminUser = await AdminUserModel.findOne({
      _id: adminId,
    }).session(session);

    // If the admin user is not found, abort the transaction and return a 404 error
    if (!adminUser) {
      // Abort the transaction
      await session.abortTransaction();

      // End the session
      session.endSession();

      // Return an error
      return res.status(404).json({ message: "Admin user not found" });
    }

    // Verify password
    const isValid = await verifyPassword(adminUser.password, req.body.password);

    // If password is not valid
    if (!isValid) {
      // Abort the transaction
      await session.abortTransaction();

      // End the session
      session.endSession();

      // Return an error
      return res.status(400).json({ message: "Invalid password" });
    }

    // Find the user by ID
    const user = await UserModel.findOne({
      _id: id,
    }).session(session);

    // If the user is not found, abort the transaction and return a 404 error
    if (!user) {
      // Abort the transaction
      await session.abortTransaction();

      // End the session
      session.endSession();

      // Return an error
      return res.status(404).json({ message: "User not found" });
    }

    // Set the isDeleted flag to true and set the deletedAt timestamp
    user.isDeleted = true;
    user.deletedAt = Date.now();

    // Save the updated user
    await user.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    // End the session
    session.endSession();

    // Return the updated user
    return res
      .status(200)
      .json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    // Abort the transaction
    await session.abortTransaction();

    // End the session
    session.endSession();

    // Log the error
    console.error("Error deleting user :", error);

    // Return an error response
    return res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error deleting user.", error });
  }
};

// Define Yup validation schema
// Define Yup validation schema
const userSchema = yup.object().shape({
  name: yup.string().required("Name is required"),
  email: yup.string().email().required("Email is required"),
  phone: yup
    .string()
    .required("Phone number is required")
    .length(10, "Phone number must be exactly 10 characters long"),
  password: yup.string().required("Password is required"),
});

// API function to update a user
const updateUser  = async (req, res) => {
  // Extract the user ID from the request parameters
  const { id } = req.params;

  // Start a new Mongoose session
  const session = await mongoose.startSession();

  // Start a transaction
  session.startTransaction();

  try {
    // Validate the user data
    const { error } = await userSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      // Abort the transaction
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: error.message });
    }

    const adminId = req.user._id;

    // Find the admin user by ID within the session
    const adminUser  = await AdminUserModel.findOne({ _id: adminId }).session(session);

    // If the admin user is not found, abort the transaction and return a 404 error
    if (!adminUser ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Admin user not found" });
    }

    // Verify password
    const isValid = await verifyPassword(adminUser .password, req.body.password);

    // If password is not valid
    if (!isValid) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid password" });
    }

    // Find the user by ID within the session
    const user = await UserModel.findOne({ _id: id }).session(session);

    // If the user is not found, abort the transaction and return a 404 error
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "User  not found" });
    }

    // Check if the new email already exists (excluding the current user)
    if (req.body.email && req.body.email !== user.email) {
      const existingEmailUser  = await UserModel.findOne({ email: req.body.email }).session(session);
      if (existingEmailUser ) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success : false , error: "Email already exists" });
      }
    }

    // Check if the new phone number already exists (excluding the current user)
    if (req.body.phone && req.body.phone !== user.phone) {
      const existingPhoneUser  = await UserModel.findOne({ phone: req.body.phone }).session(session);
      if (existingPhoneUser ) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success : false , error : "Phone number already exists" });
      }
    }

    // Update the user with the new data
    user.name = req.body.name;
    user.email = req.body.email;
    user.phone = req.body.phone;

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
      paymentHistory: user.paymentHistory,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Return the updated user
    return res.status(200).json({
      success: true,
      data: response_data,
      message: "User  updated successfully",
    });
  } catch (error) {
    // Abort the transaction
    await session.abortTransaction();
    session.endSession();
    return res.status(error.code ?? 500).json({ message: error?.message ?? "Error updating user", error });
  }
};

// take the amount to update , admin note for transaction , type of transaction credit , debit
const updateUserWalletBalanceSchema = yup.object().shape({
  amount: yup
    .number()
    .required("Amount is required")
    .min(1, "Amount must be at least 1"),
  adminNote: yup.string().required("Admin note is required"),
  // debit or credit enum
  update_type: yup
    .string()
    .required("Type is required")
    .oneOf([...Object.values(TRANSACTION_TYPE)]),
});

const updateUserWalletBalance = async (req, res) => {
  const { id } = req.params;

  // Start a new Mongoose session
  const session = await mongoose.startSession();

  // Start a transaction
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    // Validate the user data
    const { error } = await updateUserWalletBalanceSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      // Abort the transaction
      await session.abortTransaction();

      // End the session
      session.endSession();

      // Return an error
      return res.status(400).json({ error: error.message });
    }

    const { amount, adminNote, update_type } = req.body;

    const adminId = req.user._id;

    // Find the admin user by ID within the session
    const adminUser = await AdminUserModel.findOne({
      _id: adminId,
    }).session(session);

    // If the admin user is not found, abort the transaction and return a 404 error
    if (!adminUser) {
      // Abort the transaction
      await session.abortTransaction();

      // End the session
      session.endSession();

      // Return an error
      return res.status(404).json({ message: "Admin user not found" });
    }

    // Verify password
    const isValid = await verifyPassword(adminUser.password, req.body.password);

    // If password is not valid
    if (!isValid) {
      // Abort the transaction
      await session.abortTransaction();

      // End the session
      session.endSession();

      // Return an error
      return res.status(400).json({ message: "Invalid password" });
    }

    // Find the user by ID within the session
    const user = await UserModel.findOne({
      _id: id,
    }).session(session);

    // If the user is not found, abort the transaction and return a 404 error
    if (!user) {
      // Abort the transaction
      await session.abortTransaction();

      // End the session
      session.endSession();

      // Return an error
      return res.status(404).json({ message: "User not found" });
    }

    // create payload for transaction Creation
    const transactionPayloadCreation = {
      user_id: user._id,
      transaction_type: update_type,
      description: `Manual update of wallet balance for ${amount} ${
        update_type === TRANSACTION_TYPE.CREDIT ? "credit" : "debit"
      } by ${adminUser.name} - ${adminNote}`,
      payment_method: PAYMENT_METHOD.WALLET,
      amount,
      status: TRANSACTION_STATUS.COMPLETED,
      wallet_topUp: true,
    };

    const transaction = new TransactionModel(transactionPayloadCreation);

    // Save the transaction
    await transaction.save({ session });

    // create an payment history record
    const paymentHistoryRecord = {
      amount: amount,
      transaction_id: transaction._id,
      starting_balance: user.walletBalance,
      transaction_type: update_type,
      closing_balance:
        update_type === TRANSACTION_TYPE.CREDIT
          ? user.walletBalance + amount
          : user.walletBalance - amount,
      description: `Manual update of wallet balance for ${amount} ${
        update_type === TRANSACTION_TYPE.CREDIT ? "credit" : "debit"
      } by ${adminUser.name} - ${adminNote}`,
    };

    user.paymentHistory.push(paymentHistoryRecord);
    user.walletBalance =
      update_type === TRANSACTION_TYPE.CREDIT
        ? user.walletBalance + amount
        : user.walletBalance - amount;

    // Save the user
    await user.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    // End the session
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
      paymentHistory: user.paymentHistory,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return res.status(200).json({
      message: "User updated successfully",
      data: response_data,
      success: true,
    });
  } catch (error) {
    // Abort the transaction
    await session.abortTransaction();

    // End the session
    session.endSession();

    // Return an error
    return res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error updating user", error });
  }
};

const toggleUserPrimeMemberSchema = yup.object().shape({
  credit_membership_amount: yup
    .boolean()
    .required(
      "Whether to credit membership amount to wallet or not is required"
    ),
  adminNote: yup.string().required("Admin note is required"),
  password: yup.string().required("Password is required"),
});

const toggleUserPrimeMember = async (req, res) => {
  const { id } = req.params;

  // Start a new Mongoose session
  const session = await mongoose.startSession();

  // Start a transaction
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    // Validate the request body

    const { error } = await toggleUserPrimeMemberSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      // Abort the transaction
      await session.abortTransaction();

      // End the session
      session.endSession();

      // Return an error
      return res
        .status(error.code ?? 400)
        .json({ message: error?.message ?? "Validation error", error });
    }

    const { credit_membership_amount, adminNote, password } = req.body;

    const adminId = req.user._id;

    const adminUser = await AdminUserModel.findOne({
      _id: adminId,
    }).session(session);

    // If the admin user is not found, abort the transaction and return a 404 error
    if (!adminUser) {
      // Abort the transaction
      await session.abortTransaction();

      // End the session
      session.endSession();

      // Return an error
      return res.status(404).json({ message: "Admin user not found" });
    }

    // Verify password
    const isValid = await verifyPassword(adminUser.password, req.body.password);

    // If password is not valid
    if (!isValid) {
      // Abort the transaction
      await session.abortTransaction();

      // End the session
      session.endSession();

      // Return an error
      return res.status(400).json({ message: "Invalid password" });
    }

    const user = await UserModel.findOne({
      _id: id,
    }).session(session);

    // If the user is not found, abort the transaction and return a 404 error
    if (!user) {
      // Abort the transaction
      await session.abortTransaction();

      // End the session
      session.endSession();

      // Return a 404 response with a message
      return res.status(404).json({ message: "User not found" });
    }

    if (credit_membership_amount && !user.isPrimeMember) {
      user.isPrimeMember = true;

      // create payload for transaction Creation
      const transactionPayloadCreation = {
        user_id: user._id,
        transaction_type: TRANSACTION_TYPE.CREDIT,
        description: `Credit membership amount to wallet by ${adminUser.name} - ${adminNote}`,
        payment_method: PAYMENT_METHOD.WALLET,
        amount: PRIME_MEMBERSHIP_AMOUNT,
        status: TRANSACTION_STATUS.COMPLETED,
        wallet_topUp: true,
      };

      const transaction = new TransactionModel(
        transactionPayloadCreation
      );

      // Save the transaction
      await transaction.save({ session });

      // create an payment history record
      const paymentHistoryRecord = {
        amount: PRIME_MEMBERSHIP_AMOUNT,
        transaction_id: transaction._id,
        starting_balance: user.walletBalance,
        transaction_type: TRANSACTION_TYPE.CREDIT,
        closing_balance: user.walletBalance + PRIME_MEMBERSHIP_AMOUNT,
        description: `Credit membership amount to wallet by ${adminUser.name} - ${adminNote}`,
      };

      user.paymentHistory.push(paymentHistoryRecord);

      user.walletBalance = user.walletBalance + PRIME_MEMBERSHIP_AMOUNT;
    } else if (!credit_membership_amount && !user.isPrimeMember) {
      user.isPrimeMember = true;
    } else if (user.isPrimeMember) {
      user.isPrimeMember = false;
    }

    await user.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    // End the session
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
      paymentHistory: user.paymentHistory,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return res.status(200).json({
      message: "User updated successfully",
      data: response_data,
      success: true,
    });
  } catch (error) {
    // Abort the transaction
    await session.abortTransaction();

    // End the session
    session.endSession();

    // Return an error
    return res
      .status(error.code ?? 500)
      .json({ message: error?.message ?? "Error updating user", error });
  }
};
module.exports = {
  getUsers,
  toggleUserStatus,
  getUserById,
  softDeleteUser,
  updateUser,
  updateUserWalletBalance,
  toggleUserPrimeMember,
};
