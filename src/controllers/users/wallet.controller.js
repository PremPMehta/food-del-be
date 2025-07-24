const mongoose = require("mongoose");
const yup = require("yup");

const PaymentModel = require("../../models/payment.model");
const TransactionModel = require("../../models/transaction.model");
const UserModel = require("../../models/users.model");
const { USER_STATUS, TRANSACTION_TYPE } = require("../../utils/constants");
const { paypalCreateOrder } = require("../../services/paypal/paypal");
const {
  FRONTEND_URL,
  PRIME_MEMBERSHIP_AMOUNT,
  FRONTEND_PAYMENT_REDIRECT_URL,
} = require("../../config/config");
const { createRazorpayOrder } = require("../../services/razorpay/razorpay");

const walletTopUpSchema = yup.object().shape({
  amount: yup.number().required("Amount is required"),
});
// previous code

// const walletTopUp = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction(); // Start the transaction immediately after creating the session

//   try {
//     // Validate request body
//     await walletTopUpSchema.validate(req.body);

//     const { amount } = req.body;

//     const user_id = req.user._id;
//     // Find user by email
//     const user = await UserModel.findOne({ _id: user_id }).session(session);

//     if (!user || user.status === USER_STATUS.INACTIVE) {
//       throw new Error({
//         message: "User not found",
//         code: 404,
//       });
//     }

//     const paymentData = {
//       order_description: `Wallet top-up payment ${amount?.toFixed(2)}`,
//       amount: amount,
//       return_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/wallet-topup/${user_id}/success`,
//       cancel_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/wallet-topup/${user_id}/failure`,
//       user_id: user_id,
//       wallet_topUp: true,
//     };

//     const payment = await paypalCreateOrder(paymentData);

//     if (!payment) {
//       throw new Error({
//         message: "Payment creation failed.",
//         code: 500,
//       });
//     }

//     const paymentHistoryRecord = {
//       payment_id: payment.createPayment.order_id,
//       reference_id: payment.createPayment._id,
//       amount: amount,
//       transaction_id: payment.createTransaction._id,
//       starting_balance: user.walletBalance,
//       transaction_type: TRANSACTION_TYPE.CREDIT,
//       closing_balance: user.walletBalance + amount,
//       description: payment.createPayment.description,
//       timestamp: Date.now(),
//     };

//     user.paymentHistory.unshift(paymentHistoryRecord);

//     await user.save({ session });

//     const responsePayload = {
//       walletBalance: user.walletBalance,
//       payment_link: payment.payment_link,
//     };

//     // Commit the transaction
//     await session.commitTransaction();
//     session.endSession();

//     return res.status(200).json(responsePayload);
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();

//     return res.status(error.status ?? 500).json({
//       message: error?.code ?? error?.message ?? "Internal server error",
//       error,
//     });
//   }
// };

const walletTopUp = async (req, res) => {
  try {
    // Validate request body
    await walletTopUpSchema.validate(req.body);

    const { amount } = req.body;

    const user_id = req.user._id;
    // Find user by email
    const user = await UserModel.findOne({ _id: user_id });

    if (!user || user.status === USER_STATUS.INACTIVE) {
      throw new Error({
        message: "User not found",
        code: 404,
      });
    }

    const paymentData = {
      order_description: `Wallet top-up payment ${amount?.toFixed(2)}`,
      amount: amount,
      return_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/wallet-topup/${user_id}/success`,
      cancel_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/wallet-topup/${user_id}/failure`,
      user_id: user_id,
      wallet_topUp: true,
    };

    // const payment = await paypalCreateOrder(paymentData);
    const payment = await createRazorpayOrder(paymentData);

    if (!payment) {
      throw new Error({
        message: "Payment creation failed.",
        code: 500,
      });
    }

    // const paymentHistoryRecord = {
    //   payment_id: payment.createPayment.order_id,
    //   reference_id: payment.createPayment._id,
    //   amount: amount,
    //   transaction_id: payment.createTransaction._id,
    //   starting_balance: user.walletBalance,
    //   transaction_type: TRANSACTION_TYPE.CREDIT,
    //   closing_balance: user.walletBalance + amount,
    //   description: payment.createPayment.description,
    //   timestamp: Date.now(),
    // };

    // user.paymentHistory.unshift(paymentHistoryRecord);

    // await user.save();

    const responsePayload = {
      walletBalance: user.walletBalance,
      payment_link: payment.payment_link,
    };

    return res.status(200).json(responsePayload);
  } catch (error) {
    return res.status(error.status ?? 500).json({
      message: error?.code ?? error?.message ?? "Internal server error",
      error,
    });
  }
};

// api to get wallet balance
const getWalletBalance = async (req, res) => {
  try {
    const user = await UserModel.findOne({ _id: req.user._id });

    if (!user) {
      return res.status(404).json({ message: "User  not found" });
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      return res.status(400).json({ message: "User  is inactive" });
    }

    // Fetch transactions related to the user's payment history
    const transactions = await TransactionModel.find({
      _id: {
        $in: user.paymentHistory.map((payment) => payment.transaction_id),
      },
    });

    // Map through the payment history to include transaction status
    const transactionHistoryWithStatus = user.paymentHistory.map((payment) => {
      const transaction = transactions.find(
        (t) => t._id.toString() === payment.transaction_id.toString()
      );
      return {
        payment_id: payment.payment_id,
        reference_id: payment.reference_id,
        amount: payment.amount,
        transaction_id: payment.transaction_id,
        starting_balance: payment.starting_balance,
        transaction_type: payment.transaction_type,
        closing_balance: payment.closing_balance,
        description: payment.description,
        timestamp: payment.timestamp,
        status: transaction ? transaction.status : "Unknown", // Handle case where transaction might not be found
      };
    });

    return res.status(200).json({
      walletBalance: user.walletBalance,
      transaction_history: transactionHistoryWithStatus,
    });
  } catch (error) {
    return res.status(error.status ?? 500).json({
      message: error?.code ?? error?.message ?? "Internal server error",
      error,
    });
  }
};

module.exports = {
  walletTopUp,
  getWalletBalance,
};
