// Import the mongoose module to interact with MongoDB
const mongoose = require("mongoose");

// Import the yup module for schema validation
const yup = require("yup");

// Import the ThalModel which is a mongoose model representing a thal in the database
const ThalModel = require("../../models/thal.model");

// Import the CategoryModel which is a mongoose model representing a category in the database
const CategoryModel = require("../../models/category.model");

// Import the UserModel which is a mongoose model representing a user in the database
const UserModel = require("../../models/users.model");

// Import the TransactionModel which is a mongoose model representing a transaction in the database
const TransactionModel = require("../../models/transaction.model");

// Import OrderStatus, a constant that defines the status values for orders
const {
  ORDER_STATUS,
  ORDER_TYPE,
  TRANSACTION_TYPE,
  PAYMENT_METHOD,
  TRANSACTION_STATUS,
  ORDER_STATUS_MESSAGE,
} = require("../../utils/constants");

const OrderModel = require("../../models/order.model");

const { adminAuthenticate } = require("../../middleware/auth");

const querySchema = yup.object().shape({
  page: yup.number().integer().min(1).default(1),
  limit: yup.number().integer().min(1).max(100).default(10),
  sortBy: yup
    .string()
    .oneOf(["title", "createdAt", "updatedAt"], "Invalid sort field")
    .default("createdAt"),
  sortOrder: yup
    .string()
    .oneOf(["asc", "desc"], "Invalid sort order")
    .default("desc"),
  search: yup.string().optional(),
});

// Paginated listing API
const getThalOrders = async (req, res) => {
  try {
    // Validate query parameters
    const validatedQuery = await querySchema.validate(req.query, {
      abortEarly: false,
    });

    const { page, limit, sortBy, sortOrder, search } = validatedQuery;

    // Build the query
    const query = {
      orderType: ORDER_TYPE.THAL, // Ensure we only fetch THAL orders
    };

    // If a search term is provided, include it in the query
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // Fetch the total count of thal orders matching the query
    const totalThalOrders = await OrderModel.countDocuments(query);

    // Paginate the query
    const thalOrders = await OrderModel.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ [sortBy]: sortOrder });

    return res.status(200).json({
      success: true,
      thalOrders: thalOrders,
      pagination: {
        total: totalThalOrders,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalThalOrders / limit),
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

const getThalOrderById = async (req, res) => {
  try {
    const thalOrder = await OrderModel.findById(req.params.id);

    if (!thalOrder) {
      return res.status(404).json({
        success: false,
        error: "Thal order not found",
      });
    }

    return res.status(200).json({
      success: true,
      thalOrder: thalOrder,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

const updateThalOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction(); // Start the transaction immediately after creating the session    try {
  try {
    const thalOrder = await OrderModel.findById(req.params.id);

    if (!thalOrder) {
      // Abort the transaction
      await session.abortTransaction();

      // End the session
      session.endSession();

      return res.status(404).json({
        success: false,
        error: "Thal order not found",
      });
    }

    switch (req.body.status) {
      case ORDER_STATUS_MESSAGE.PENDING:
        thalOrder.status = ORDER_STATUS_MESSAGE.PENDING;
        break;
      case ORDER_STATUS_MESSAGE.ACCEPTED:
        thalOrder.status = ORDER_STATUS_MESSAGE.ACCEPTED;
        break;
      case ORDER_STATUS_MESSAGE.REJECTED:
        thalOrder.status = ORDER_STATUS_MESSAGE.REJECTED;
        break;
      case ORDER_STATUS_MESSAGE.CANCELLED:
        thalOrder.status = ORDER_STATUS_MESSAGE.CANCELLED;
        break;
      case ORDER_STATUS_MESSAGE.COMPLETED:
        thalOrder.status = ORDER_STATUS_MESSAGE.COMPLETED;
        break;
      default:
        // Abort the transaction
        await session.abortTransaction();

        // End the session
        session.endSession();

        return res.status(400).json({
          success: false,
          error: "Invalid status",
        });
    }

    if (req.body.status === ORDER_STATUS_MESSAGE.ACCEPTED) {
      if (thalOrder.totalAmount >= 2000) {
        const rewardAmount = (thalOrder.totalAmount * 3.37) / 100;

        const userDetails = await UserModel.findOne({
          _id: thalOrder.user,
        });
        const rewardTransactionPayload = {
          user_id: userDetails._id,
          amount: rewardAmount,
          transaction_type: TRANSACTION_TYPE.CREDIT,
          description: `Earn bonus for ${userDetails.name} Order thal amount of ${thalOrder.totalAmount}`,
          amount: parseFloat(rewardAmount),
          status: TRANSACTION_STATUS.COMPLETED,
          wallet_topUp: true,
          payment_method: PAYMENT_METHOD.WALLET,
        };

        // create the reward transaction
        const rewardTransaction = new TransactionModel(
          rewardTransactionPayload
        );

        // save the reward transaction
        await rewardTransaction.save({
          session,
        });

        // create the payload for payment history
        const referrerPaymentHistoryPayload = {
          amount: parseFloat(rewardAmount),
          transaction_id: rewardTransaction._id,
          starting_balance: userDetails.walletBalance,
          transaction_type: TRANSACTION_TYPE.CREDIT,
          closing_balance: userDetails.walletBalance + parseFloat(rewardAmount),
          description: `Earn bonus for ${userDetails.name} Order Of ${thalOrder.totalAmount}`,
        };

        userDetails.paymentHistory.unshift(referrerPaymentHistoryPayload);

        // update the parent user wallet
        userDetails.walletBalance += parseFloat(rewardAmount);

        // save the parent user
        await userDetails.save({
          session,
        });
      }
    }

    thalOrder.status = req.body.status;
    await thalOrder.save({ session });

    if (
      req.body.status === ORDER_STATUS_MESSAGE.CANCELLED ||
      req.body.status === ORDER_STATUS_MESSAGE.REJECTED
    ) {
      const parentUser = await UserModel.findOne({
        _id: thalOrder.user,
      });

      if (thalOrder.totalAmount >= 2000) {
        const rewardAmount = (thalOrder.totalAmount * 3.37) / 100;
        const rewardTransactionPayload = {
          user_id: parentUser._id,
          amount: rewardAmount,
          transaction_type: TRANSACTION_TYPE.CREDIT,
          description: `Your thal order of amount ${thalOrder.totalAmount} has been successfully reversed.`,
          amount: parseFloat(-rewardAmount),
          status: TRANSACTION_STATUS.FAILED,
          wallet_topUp: false,
          payment_method: PAYMENT_METHOD.WALLET,
        };

        // create the reward transaction
        const rewardTransaction = new TransactionModel(
          rewardTransactionPayload
        );

        // save the reward transaction
        await rewardTransaction.save({
          session,
        });

        // create the payload for payment history
        const referrerPaymentHistoryPayload = {
          amount: parseFloat(rewardAmount),
          transaction_id: rewardTransaction._id,
          starting_balance: parentUser.walletBalance,
          transaction_type: TRANSACTION_TYPE.DEBIT,
          closing_balance: parentUser.walletBalance - parseFloat(rewardAmount),
          description: `Your order of ${thalOrder.totalAmount} has been successfully reversed.`,
        };

        parentUser.paymentHistory.unshift(referrerPaymentHistoryPayload);

        // update the parent user wallet
        parentUser.walletBalance -= parseFloat(rewardAmount);

        // save the parent user
        await parentUser.save({
          session,
        });
      }

      const transactionPayloadCreation = {
        user_id: thalOrder.user,
        transaction_type: TRANSACTION_TYPE.CREDIT,
        description: `Order Refund for ${thalOrder._id} status updated to ${req.body.status}`,
        payment_method: PAYMENT_METHOD.WALLET,
        amount: thalOrder.totalAmount,
        status: TRANSACTION_STATUS.COMPLETED,
        wallet_topUp: false,
      };

      const transaction = new TransactionModel(transactionPayloadCreation);
      await transaction.save({ session });

      const user = await UserModel.findById(thalOrder.user);

      const paymentHistoryRecord = {
        amount: thalOrder.totalAmount,
        transaction_id: transaction._id,
        starting_balance: user.walletBalance,
        transaction_Type: TRANSACTION_TYPE.CREDIT,
        closing_balance: user.walletBalance + thalOrder.totalAmount,
        description: `Order Refund for ${thalOrder._id} status updated to ${req.body.status}`,
      };

      user.paymentHistory.push(paymentHistoryRecord);
      user.walletBalance += thalOrder.totalAmount;

      await user.save({ session });
    }

    // Commit the transaction
    await session.commitTransaction();

    // End the session
    session.endSession();

    return res.status(200).json({
      success: true,
      thalOrder: thalOrder,
    });
  } catch (error) {
    // Abort the transaction
    await session.abortTransaction();

    // End the session
    session.endSession();
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getThalOrders,
  getThalOrderById,
  updateThalOrderStatus,
};
