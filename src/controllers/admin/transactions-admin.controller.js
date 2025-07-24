// The following line imports the mongoose module which is used to interact with MongoDB
const mongoose = require("mongoose");

// The following line imports the Yup module which is used for validation
const yup = require("yup");

// The following line imports the TransactionModel which is a mongoose model that represents a transaction in the database
const TransactionModel = require("../../models/transaction.model");

// The following line imports the UserModel which is a mongoose model that represents a user in the database
const UserModel = require("../../models/users.model");
const {
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
} = require("../../utils/constants");

// Yup schema for validation
const querySchema = yup.object().shape({
  page: yup.number().integer().min(1).default(1),
  limit: yup.number().integer().min(1).max(100).default(10),
  sortBy: yup
    .string()
    .oneOf(
      [
        "createdAt",
        "updatedAt",
        "transaction_type",
        "payment_method",
        "status",
      ],
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
const getTransactions = async (req, res) => {
  try {
    // Validate query parameters
    const validatedQuery = await querySchema.validate(req.query, {
      abortEarly: false,
    });

    // Extract query parameters
    const { page, limit, sortBy, sortOrder, search } = validatedQuery;

    // Build the query
    const query = {};

    if (search) {
      query.$or = [
        { description: { $regex: search, $options: "i" } },
        // Uncomment the line below if you want to search by user email as well
        { "user.name": { $regex: search, $options: "i" } },
        { "user.email": { $regex: search, $options: "i" } },
        { "user.phone": { $regex: search, $options: "i" } },
      ];
    }

    // Fetch the total count of transactions matching the query
    const totalTransactions = await TransactionModel.countDocuments(query);

    // Fetch the paginated and sorted transactions, and populate user details
    const transactions = await TransactionModel.find(query)
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user_id', 'name email phone'); // Populate user_id with name and phone fields

    if (!transactions || transactions.length === 0) {
      return res.status(404).json({ message: "Transactions not found" });
    }

    return res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        total: totalTransactions,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalTransactions / limit),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error fetching transactions" });
  }
};

module.exports = {
  getTransactions,
};