// Import the mongoose module to interact with MongoDB
// const mongoose = require("mongoose");
const { Types, mongoose } = require("mongoose");
const ObjectId = Types.ObjectId;

// Import the yup module for schema validation
const yup = require("yup");

const FastfoodOrderModel = require("../../models/fastfood-order.model");

// Import the UserModel which is a mongoose model representing a user in the database
const UserModel = require("../../models/users.model");

// Import the TransactionModel which is a mongoose model representing a transaction in the database
const TransactionModel = require("../../models/transaction.model");

const PaymentModal = require("../../models/payment.model");
const comboMeals = require("../../models/combo.model");
const DishModel = require("../../models/dish.model");

// Import OrderStatus, a constant that defines the status values for orders
const {
  ORDER_STATUS,
  ORDER_TYPE,
  TRANSACTION_TYPE,
  PAYMENT_METHOD,
  TRANSACTION_STATUS,
  ORDER_STATUS_MESSAGE,
} = require("../../utils/constants");
const kitchen = require("../../models/kitchen.model");

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
const getFastFoodOrders = async (req, res) => {
  try {
    // Validate query parameters
    const validatedQuery = await querySchema.validate(req.query, {
      abortEarly: false,
    });

    const { page, limit, sortBy, sortOrder, search } = validatedQuery;
    console.log("req.admin.kitchen", req.admin.kitchen);
    const query = {
      orderType: ORDER_TYPE.FASTFOOD, // Ensure we only fetch fastfood orders
      kitchen: { $in: req.admin.kitchen },
    };

    console.log("query", query);

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
    const totalFastFoodOrders = await FastfoodOrderModel.countDocuments(query);

    // Paginate the query
    const fastFoodOrders = await FastfoodOrderModel.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ [sortBy]: sortOrder });

    return res.status(200).json({
      success: true,
      FastFoodOrders: fastFoodOrders,
      pagination: {
        total: totalFastFoodOrders,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalFastFoodOrders / limit),
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

const getFastFoodOrderById = async (req, res) => {
  try {
    // const fastFoodOrder = await FastfoodOrderModel.findById(
    //   req.params.id
    // )

    const id = new mongoose.Types.ObjectId(req.params.id);
    const fastFoodOrder = await FastfoodOrderModel.findById(req.params.id);

    if (!fastFoodOrder) {
      return res.status(404).json({
        success: false,
        error: "Fast food order not found",
      });
    }

    const combosIds = fastFoodOrder.combos.map((x) => x.combo);

    const comboDetails = await comboMeals
      .find({
        _id: { $in: combosIds },
        isDeleted: false,
      })
      .populate({
        path: "dishes",
        model: DishModel,
      });

    const transactionDetails = await TransactionModel.findById(
      fastFoodOrder?.paymentIds
    );

    const paymentDetails = await PaymentModal.findById(
      transactionDetails?.payment_id
    );

    return res.status(200).json({
      success: true,
      fastFoodOrder: {
        ...fastFoodOrder.toJSON(),
        comboDetails,
        transactionDetails,
        paymentDetails,
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

const updateFasFoodOrderStatus = async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction(); // Start the transaction immediately after creating the session    try {
  try {
    const fastfoodOrder = await FastfoodOrderModel.findById(req.params.id);

    if (!fastfoodOrder) {
      // Abort the transaction
      await session.abortTransaction();

      // End the session
      session.endSession();

      return res.status(404).json({
        success: false,
        error: "Thal order not found",
      });
    }

    // const parentUser = await UserModel.findOne({ _id: fastfoodOrder.user });
    // if (!parentUser) {
    //   // Abort the transaction
    //   await session.abortTransaction();

    //   // End the session
    //   session.endSession();

    //   return res.status(404).json({
    //     success: false,
    //     error: "user not found for this order",
    //   });
    // }

    switch (req.body.status) {
      case ORDER_STATUS_MESSAGE.PENDING:
        fastfoodOrder.status = ORDER_STATUS_MESSAGE.PENDING;
        break;
      case ORDER_STATUS_MESSAGE.ACCEPTED:
        fastfoodOrder.status = ORDER_STATUS_MESSAGE.ACCEPTED;
        break;
      case ORDER_STATUS_MESSAGE.REJECTED:
        fastfoodOrder.status = ORDER_STATUS_MESSAGE.REJECTED;
        break;
      case ORDER_STATUS_MESSAGE.CANCELLED:
        fastfoodOrder.status = ORDER_STATUS_MESSAGE.CANCELLED;
        break;
      case ORDER_STATUS_MESSAGE.COMPLETED:
        fastfoodOrder.status = ORDER_STATUS_MESSAGE.COMPLETED;
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
      if (fastfoodOrder.totalAmount >= 2000) {
        const rewardAmount = (fastfoodOrder.totalAmount * 3.37) / 100;

        const userDetails = await UserModel.findOne({
          _id: fastfoodOrder.user,
        });
        const rewardTransactionPayload = {
          user_id: userDetails._id,
          amount: rewardAmount,
          transaction_type: TRANSACTION_TYPE.CREDIT,
          description: `Earn bonus for ${userDetails.name} Order Of ${fastfoodOrder.totalAmount}`,
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
          description: `Earn bonus for ${userDetails.name} Order Of ${fastfoodOrder.totalAmount}`,
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

    fastfoodOrder.status = req.body.status;
    await fastfoodOrder.save({ session });

    if (
      req.body.status === ORDER_STATUS_MESSAGE.CANCELLED ||
      req.body.status === ORDER_STATUS_MESSAGE.REJECTED
    ) {
      const parentUser = await UserModel.findOne({
        _id: fastfoodOrder.user,
      });

      if (fastfoodOrder.totalAmount >= 2000) {
        const rewardAmount = (fastfoodOrder.totalAmount * 3.37) / 100;
        const rewardTransactionPayload = {
          user_id: parentUser._id,
          amount: rewardAmount,
          transaction_type: TRANSACTION_TYPE.CREDIT,
          description: `Your order of ${fastfoodOrder.totalAmount} has been successfully reversed.`,
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
          description: `Your order of ${fastfoodOrder.totalAmount} has been successfully reversed.`,
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
        user_id: fastfoodOrder.user,
        transaction_type: TRANSACTION_TYPE.CREDIT,
        description: `Order Refund for ${fastfoodOrder._id} status updated to ${req.body.status}`,
        payment_method: PAYMENT_METHOD.WALLET,
        amount: fastfoodOrder.totalAmount,
        status: TRANSACTION_STATUS.COMPLETED,
        wallet_topUp: false,
      };

      const transaction = new TransactionModel(transactionPayloadCreation);
      await transaction.save({ session });

      const paymentHistoryRecord = {
        amount: fastfoodOrder.totalAmount,
        transaction_id: transaction._id,
        starting_balance: parentUser.walletBalance,
        transaction_Type: TRANSACTION_TYPE.CREDIT,
        closing_balance: parentUser.walletBalance + fastfoodOrder.totalAmount,
        description: `Order Refund for ${fastfoodOrder._id} status updated to ${req.body.status}`,
      };

      parentUser.paymentHistory.push(paymentHistoryRecord);
      parentUser.walletBalance += fastfoodOrder.totalAmount;

      await parentUser.save({ session });
    }

    // Commit the transaction
    await session.commitTransaction();

    // End the session
    session.endSession();

    return res.status(200).json({
      success: true,
      fastfoodOrder: fastfoodOrder,
    });
  } catch (error) {
    // Abort the transaction
    console.log(error);
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
  getFastFoodOrders,
  updateFasFoodOrderStatus,
  getFastFoodOrderById,
};
