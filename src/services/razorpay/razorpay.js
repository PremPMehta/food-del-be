const Razorpay = require("razorpay");
const crypto = require("crypto");
const {
  validateWebhookSignature,
} = require("razorpay/dist/utils/razorpay-utils");
// Require the Axios library to make HTTP requests
const axios = require("axios");
// Import the mongoose library to interact with the MongoDB database
const mongoose = require("mongoose");

// Load the Mongoose model for the PayPal payment transactions
const PaymentModel = require("../../models/payment.model");
const UserModel = require("../../models/users.model");

// Load the Mongoose model for the Transaction
const TransactionModel = require("../../models/transaction.model");
const orderModel = require("../../models/order.model");

// Load the configuration variables for the PayPal API
const {
  RAZORPAY_ID_KEY,
  RAZORPAY_SECRET_KEY,
  WEBHOOK_SECRET,
  PRIME_MEMBERSHIP_AMOUNT,
  RAZORPAY_SANDBOX_MODE = true, // Default to sandbox mode for testing
} = require("../../config/config");
const {
  PAYMENT_METHOD,
  TRANSACTION_TYPE,
  TRANSACTION_STATUS,
  ORDER_STATUS,
  ORDER_STATUS_MESSAGE,
} = require("../../utils/constants");
const FastFoodOrderModel = require("../../models/fastfood-order.model");
const ReferralSettingsModel = require("../../models/referral-settings.model");

/**
 * Razorpay instance configuration
 * For sandbox testing, use test keys
 * For production, use live keys
 */
const razorpayInstance = new Razorpay({
  key_id: RAZORPAY_ID_KEY,
  key_secret: RAZORPAY_SECRET_KEY,
});

/**
 * Create a Razorpay order for payment
 * @param {Object} data - Payment data
 * @param {number} data.amount - Amount in INR
 * @param {string} data.currency - Currency (default: INR)
 * @param {string} data.receipt - Receipt ID
 * @param {Object} data.notes - Additional notes
 * @returns {Promise<Object>} Razorpay order object
 */
const createRazorpayOrder = async (data) => {
  try {
    const orderData = {
      amount: Math.round(data.amount * 100), // Convert to paise
      currency: data.currency || "INR",
      receipt: data.receipt || `receipt_${Date.now()}`,
      notes: data.notes || {},
    };

    console.log("Creating Razorpay order with data:", orderData);

    const order = await razorpayInstance.orders.create(orderData);
    
    console.log("Razorpay order created:", order.id);
    
    return {
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
    };
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    throw new Error(`Failed to create Razorpay order: ${error.message}`);
  }
};

/**
 * Create a Razorpay payment link
 * @param {Object} data - Payment link data
 * @returns {Promise<Object>} Payment link object
 */
const createRazorpayPaymentLink = async (data) => {
  try {
    const paymentLinkData = {
      amount: Math.round(data.amount * 100), // Amount in paise
      currency: data.currency || "INR",
      description: data.description || "Payment for order",
      callback_url: data.callback_url,
      callback_method: data.callback_method || "get",
      notes: {
        user_id: data.user_id,
        description: data.description,
        ...data.notes,
      },
    };

    // Add customer details if provided
    if (data.customer) {
      paymentLinkData.customer = data.customer;
    }

    // Add notification settings
    if (data.notify) {
      paymentLinkData.notify = data.notify;
    }

    console.log("Creating Razorpay payment link with data:", paymentLinkData);

    const paymentLink = await razorpayInstance.paymentLink.create(paymentLinkData);

    // Save payment record in database
    const paymentPayload = {
      order_id: paymentLink.id,
      user_id: data.user_id,
      description: data.description,
      amount: data.amount,
      status: "pending",
      payment_confirmed_at: null,
    };

    const createPayment = new PaymentModel(paymentPayload);
    await createPayment.save();

    // Save transaction record in database
    const transactionPayload = {
      payment_id: createPayment._id,
      user_id: data.user_id,
      transaction_type: TRANSACTION_TYPE.CREDIT,
      description: data.description,
      payment_method: PAYMENT_METHOD.RAZORPAY,
      amount: data.amount,
      status: TRANSACTION_STATUS.PENDING,
      wallet_topUp: data.wallet_topUp || false,
      order_topUp: data.order_topUp || false,
    };

    const createTransaction = new TransactionModel(transactionPayload);
    await createTransaction.save();

    console.log("Payment link created successfully:", paymentLink.id);

    return {
      success: true,
      createPayment,
      createTransaction,
      payment_link: paymentLink.short_url,
      payment_id: paymentLink.id,
    };
  } catch (error) {
    console.error("Error creating Razorpay payment link:", error);
    throw new Error(`Failed to create payment link: ${error.message}`);
  }
};

/**
 * Verify Razorpay payment signature
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay signature
 * @returns {boolean} Verification result
 */
const verifyPaymentSignature = (orderId, paymentId, signature) => {
  try {
    const text = `${orderId}|${paymentId}`;
    const generated_signature = crypto
      .createHmac("sha256", RAZORPAY_SECRET_KEY)
      .update(text)
      .digest("hex");

    return generated_signature === signature;
  } catch (error) {
    console.error("Error verifying payment signature:", error);
    return false;
  }
};

/**
 * Capture Razorpay payment
 * @param {string} paymentId - Razorpay payment ID
 * @param {number} amount - Amount to capture (in paise)
 * @param {string} currency - Currency
 * @returns {Promise<Object>} Capture response
 */
const capturePayment = async (paymentId, amount, currency = "INR") => {
  try {
    const captureData = {
      amount: amount,
      currency: currency,
    };

    console.log("Capturing payment:", paymentId, captureData);

    const capture = await razorpayInstance.payments.capture(paymentId, captureData);
    
    console.log("Payment captured successfully:", capture.id);
    
    return {
      success: true,
      capture_id: capture.id,
      status: capture.status,
    };
  } catch (error) {
    console.error("Error capturing payment:", error);
    throw new Error(`Failed to capture payment: ${error.message}`);
  }
};

/**
 * Get payment details
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<Object>} Payment details
 */
const getPaymentDetails = async (paymentId) => {
  try {
    const payment = await razorpayInstance.payments.fetch(paymentId);
    return {
      success: true,
      payment: payment,
    };
  } catch (error) {
    console.error("Error fetching payment details:", error);
    throw new Error(`Failed to fetch payment details: ${error.message}`);
  }
};

/**
 * Get order details
 * @param {string} orderId - Razorpay order ID
 * @returns {Promise<Object>} Order details
 */
const getOrderDetails = async (orderId) => {
  try {
    const order = await razorpayInstance.orders.fetch(orderId);
    return {
      success: true,
      order: order,
    };
  } catch (error) {
    console.error("Error fetching order details:", error);
    throw new Error(`Failed to fetch order details: ${error.message}`);
  }
};

/**
 * Process Razorpay webhook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const razorpayVerifyWebhook = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const razorpaySignature = req.headers["x-razorpay-signature"];

    if (!razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: "Signature not found",
      });
    }

    console.log("Webhook received:", JSON.stringify(req.body));

    // Verify webhook signature
    const isValidCheck = await validateWebhookSignature(
      JSON.stringify(req.body),
      razorpaySignature,
      WEBHOOK_SECRET
    );

    if (!isValidCheck) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    const { event, payload } = req.body;
    console.log("Processing webhook event:", event);

    if (event === "payment_link.paid") {
      const paymentLinkId = payload.payment_link?.entity?.order_id;
      const paymentId = payload?.payment_link?.entity.id;
      const amountPaid = payload?.payment_link?.entity?.amount_paid;

      const payment = await PaymentModel.findOne({
        order_id: paymentId,
        payment_confirmed_at: null,
      }).session(session);

      if (!payment) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      // Verify amount
      if (amountPaid !== payment.amount * 100) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Amount mismatch",
        });
      }

      const transaction = await TransactionModel.findOne({
        payment_id: payment._id,
      }).session(session);

      if (!transaction) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: "Transaction not found",
        });
      }

      if (transaction.status !== TRANSACTION_STATUS.PENDING) {
        await session.abortTransaction();
        session.endSession();
        return res.status(200).json({
          success: true,
          message: "Transaction already processed",
        });
      }

      // Process the payment based on transaction type
      await processPaymentTransaction(transaction, payment, amountPaid, session);

    } else if (event === "payment_link.expired") {
      const paymentId = payload?.payment_link?.entity.id;

      await PaymentModel.findOneAndUpdate(
        { order_id: paymentId },
        {
          status: TRANSACTION_STATUS.FAILED,
          payment_confirmed_at: new Date(),
        },
        { session }
      );

      await session.commitTransaction();
      session.endSession();
      
      return res.status(200).json({
        success: true,
        message: "Payment link expired",
      });
    } else {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Unsupported event type",
      });
    }

    await session.commitTransaction();
    session.endSession();
    
    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error processing webhook:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Process payment transaction based on type
 * @param {Object} transaction - Transaction object
 * @param {Object} payment - Payment object
 * @param {number} amountPaid - Amount paid
 * @param {Object} session - MongoDB session
 */
const processPaymentTransaction = async (transaction, payment, amountPaid, session) => {
  const user = await UserModel.findOne({
    _id: transaction.user_id,
  }).session(session);

  if (!user) {
    throw new Error("User not found");
  }

  if (transaction.wallet_topUp === true) {
    // Process wallet top-up
    await processWalletTopUp(transaction, payment, user, amountPaid, session);
  } else if (!user.isPrimeMember && amountPaid === PRIME_MEMBERSHIP_AMOUNT * 100) {
    // Process prime membership
    await processPrimeMembership(transaction, payment, user, amountPaid, session);
  } else if (transaction.order_topUp === true) {
    // Process order payment
    await processOrderPayment(transaction, payment, user, session);
  } else {
    throw new Error("Invalid transaction type");
  }
};

/**
 * Process wallet top-up
 */
const processWalletTopUp = async (transaction, payment, user, amountPaid, session) => {
  await TransactionModel.findOneAndUpdate(
    { payment_id: payment._id },
    { status: TRANSACTION_STATUS.COMPLETED },
    { session }
  );

  const paymentHistoryRecord = {
    payment_id: payment.order_id,
    reference_id: payment._id,
    amount: transaction.amount,
    transaction_id: transaction._id,
    starting_balance: user.walletBalance,
    transaction_type: TRANSACTION_TYPE.CREDIT,
    closing_balance: user.walletBalance + transaction.amount,
    description: transaction.description,
    timestamp: Date.now(),
  };

  user.paymentHistory.unshift(paymentHistoryRecord);
  user.walletBalance += amountPaid / 100;

  await PaymentModel.findOneAndUpdate(
    { order_id: payment.order_id },
    {
      status: TRANSACTION_STATUS.COMPLETED,
      payment_confirmed_at: new Date(),
    },
    { session }
  );

  await user.save({ session });
};

/**
 * Process prime membership
 */
const processPrimeMembership = async (transaction, payment, user, amountPaid, session) => {
  await TransactionModel.findOneAndUpdate(
    { payment_id: payment._id },
    { status: TRANSACTION_STATUS.COMPLETED },
    { session }
  );

  const paymentHistoryRecord = {
    payment_id: payment.order_id,
    reference_id: payment._id,
    amount: transaction.amount,
    transaction_id: transaction._id,
    starting_balance: user.walletBalance,
    transaction_type: TRANSACTION_TYPE.CREDIT,
    closing_balance: user.walletBalance + transaction.amount,
    description: transaction.description,
    timestamp: Date.now(),
  };

  user.paymentHistory.unshift(paymentHistoryRecord);
  user.walletBalance += amountPaid / 100;
  user.isPrimeMember = true;

  await PaymentModel.findOneAndUpdate(
    { order_id: payment.order_id },
    {
      status: TRANSACTION_STATUS.COMPLETED,
      payment_confirmed_at: new Date(),
    },
    { session }
  );

  // Process referral rewards if applicable
  if (user.referralParents && user.referralParents.length > 0) {
    await processReferralRewards(user, payment, session);
  }

  await user.save({ session });
};

/**
 * Process order payment
 */
const processOrderPayment = async (transaction, payment, user, session) => {
  await TransactionModel.findOneAndUpdate(
    { payment_id: payment._id },
    {
      status: TRANSACTION_STATUS.COMPLETED,
      transaction_type: TRANSACTION_TYPE.DEBIT,
    },
    { session }
  );

  const paymentHistoryRecord = {
    payment_id: payment.order_id,
    reference_id: payment._id,
    amount: transaction.amount,
    transaction_id: transaction._id,
    starting_balance: user.walletBalance,
    transaction_type: TRANSACTION_TYPE.DEBIT,
    closing_balance: user.walletBalance,
    description: transaction.description,
    timestamp: Date.now(),
  };

  user.paymentHistory.unshift(paymentHistoryRecord);

  // Update order status
  if (transaction.description?.includes("fastfood")) {
    await FastFoodOrderModel.findOneAndUpdate(
      { paymentIds: transaction._id },
      { status: ORDER_STATUS_MESSAGE.PENDING },
      { session }
    );
  } else {
    await orderModel.findOneAndUpdate(
      { paymentIds: transaction._id },
      { status: ORDER_STATUS_MESSAGE.PENDING },
      { session }
    );
  }

  await PaymentModel.findOneAndUpdate(
    { order_id: payment.order_id },
    {
      status: TRANSACTION_STATUS.COMPLETED,
      payment_confirmed_at: new Date(),
    },
    { session }
  );

  await user.save({ session });
};

/**
 * Process referral rewards
 */
const processReferralRewards = async (user, payment, session) => {
  const referrerSettings = await ReferralSettingsModel.find({}, {}, { session });

  if (!referrerSettings || referrerSettings.length === 0) {
    console.log("No referral settings found");
    return;
  }

  for (const parent of user.referralParents) {
    const parentUser = await UserModel.findOne(
      { _id: parent?.userId },
      {},
      { session }
    );

    if (parentUser && parentUser.isPrimeMember) {
      const applicableSetting = referrerSettings.find(
        (setting) => setting.level === parent.level
      );

      if (!applicableSetting) continue;

      let rewardAmount = 0;

      if (payment.description.toLowerCase().includes("prime")) {
        const bonus = payment.amount * (applicableSetting?.membershipBonus?.percentage / 100);
        rewardAmount = Math.min(bonus, applicableSetting?.membershipBonus?.maxBonus)?.toFixed(2);
      } else {
        const bonus = payment.amount * (applicableSetting?.topUpBonus?.percentage / 100);
        rewardAmount = Math.min(bonus, applicableSetting?.topUpBonus?.maxBonus)?.toFixed(2);
      }

      if (rewardAmount > 0) {
        const rewardTransactionPayload = {
          user_id: parentUser._id,
          amount: rewardAmount,
          transaction_type: TRANSACTION_TYPE.CREDIT,
          description: `Referral bonus for ${user.name} - ${
            payment.description.toLowerCase().includes("prime") ? "prime membership" : "top-up"
          } - level: ${applicableSetting?.level} - ${rewardAmount}.`,
          amount: parseFloat(rewardAmount),
          status: TRANSACTION_STATUS.COMPLETED,
          wallet_topUp: true,
          payment_method: PAYMENT_METHOD.REFERRAL_REWARD,
        };

        const rewardTransaction = new TransactionModel(rewardTransactionPayload);
        await rewardTransaction.save({ session });

        const referrerPaymentHistoryPayload = {
          payment_id: payment.order_id,
          reference_id: payment._id,
          amount: parseFloat(rewardAmount),
          transaction_id: rewardTransaction._id,
          starting_balance: parentUser.walletBalance,
          transaction_type: TRANSACTION_TYPE.CREDIT,
          closing_balance: parentUser.walletBalance + parseFloat(rewardAmount),
          description: `Referral bonus for ${user.name} - ${
            payment.description.toLowerCase().includes("prime") ? "prime membership" : "top-up"
          } - level: ${applicableSetting?.level} - ${rewardAmount}.`,
        };

        parentUser.paymentHistory.unshift(referrerPaymentHistoryPayload);
        parentUser.walletBalance += parseFloat(rewardAmount);
        await parentUser.save({ session });
      }
    }
  }
};

/**
 * Fetch payments for a payment link
 * @param {string} paymentLinkId - Payment link ID
 * @returns {Promise<Object>} Payments data
 */
const fetchPayments = async (paymentLinkId) => {
  try {
    const paymentsResponse = await razorpayInstance.paymentLink.fetch(paymentLinkId);
    return {
      success: true,
      payments: paymentsResponse.payments || [],
    };
  } catch (error) {
    console.error("Error fetching payments:", error);
    throw new Error(`Failed to fetch payments: ${error.message}`);
  }
};

/**
 * Refund Razorpay payment
 * @param {Object} data - Refund data
 * @returns {Promise<Object>} Refund response
 */
const refundRazorpayOrder = async (data) => {
  try {
    const payments = await fetchPayments(data.orderId);
    
    if (!payments.success || payments.payments.length === 0) {
      throw new Error("No payments found for refund");
    }

    const payment = payments.payments[0];
    
    const refundData = {
      amount: payment.amount,
      speed: "normal", // or "optimum"
      notes: {
        reason: data.reason || "Customer requested refund",
      },
    };

    console.log("Processing refund for payment:", payment.payment_id);

    const refundResponse = await razorpayInstance.payments.refund(
      payment.payment_id,
      refundData
    );

    console.log("Refund processed successfully:", refundResponse.id);

    return {
      success: true,
      refund_id: refundResponse.id,
      status: refundResponse.status,
      amount: refundResponse.amount,
    };
  } catch (error) {
    console.error("Refund processing failed:", error);
    throw new Error(`Refund failed: ${error.message}`);
  }
};

/**
 * Get test card details for sandbox testing
 * @returns {Object} Test card details
 */
const getTestCardDetails = () => {
  return {
    success: true,
    cards: {
      success: {
        number: "4111 1111 1111 1111",
        cvv: "123",
        expiry: "12/25",
        name: "Test User",
      },
      failure: {
        number: "4000 0000 0000 0002",
        cvv: "123",
        expiry: "12/25",
        name: "Test User",
      },
      insufficient_funds: {
        number: "4000 0000 0000 9995",
        cvv: "123",
        expiry: "12/25",
        name: "Test User",
      },
    },
    upi: {
      success: "success@razorpay",
      failure: "failure@razorpay",
    },
    netbanking: {
      success: "SBIN",
      failure: "SBIN",
    },
  };
};

module.exports = {
  createRazorpayOrder,
  createRazorpayPaymentLink,
  verifyPaymentSignature,
  capturePayment,
  getPaymentDetails,
  getOrderDetails,
  razorpayVerifyWebhook,
  fetchPayments,
  refundRazorpayOrder,
  getTestCardDetails,
  razorpayInstance,
};
