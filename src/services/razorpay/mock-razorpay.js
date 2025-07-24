/**
 * Mock Razorpay Service for Development
 * This service simulates Razorpay responses for development and testing
 * without requiring actual Razorpay API keys
 */

const crypto = require("crypto");
const PaymentModel = require("../../models/payment.model");
const TransactionModel = require("../../models/transaction.model");
const UserModel = require("../../models/users.model");
const orderModel = require("../../models/order.model");
const FastFoodOrderModel = require("../../models/fastfood-order.model");
const ReferralSettingsModel = require("../../models/referral-settings.model");

const {
  PAYMENT_METHOD,
  TRANSACTION_TYPE,
  TRANSACTION_STATUS,
  ORDER_STATUS_MESSAGE,
} = require("../../utils/constants");

/**
 * Generate mock payment link
 * @param {Object} data - Payment data
 * @returns {Promise<Object>} Mock payment link response
 */
const createMockPaymentLink = async (data) => {
  try {
    const mockPaymentId = `plink_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const mockShortUrl = `https://mock-razorpay.com/pay/${mockPaymentId}`;

    // Save payment record in database
    const paymentPayload = {
      order_id: mockPaymentId,
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

    console.log("Mock payment link created:", mockPaymentId);

    return {
      success: true,
      createPayment,
      createTransaction,
      payment_link: mockShortUrl,
      payment_id: mockPaymentId,
    };
  } catch (error) {
    console.error("Error creating mock payment link:", error);
    throw new Error(`Failed to create mock payment link: ${error.message}`);
  }
};

/**
 * Simulate payment success
 * @param {string} paymentId - Mock payment ID
 * @returns {Promise<Object>} Payment success response
 */
const simulatePaymentSuccess = async (paymentId) => {
  try {
    const payment = await PaymentModel.findOne({ order_id: paymentId });
    if (!payment) {
      throw new Error("Payment not found");
    }

    const transaction = await TransactionModel.findOne({ payment_id: payment._id });
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // Update payment status
    payment.status = "completed";
    payment.payment_confirmed_at = new Date();
    await payment.save();

    // Update transaction status
    transaction.status = TRANSACTION_STATUS.COMPLETED;
    await transaction.save();

    // Process based on transaction type
    const user = await UserModel.findById(transaction.user_id);
    if (!user) {
      throw new Error("User not found");
    }

    if (transaction.wallet_topUp) {
      // Process wallet top-up
      user.walletBalance += transaction.amount;
      await user.save();
    } else if (transaction.order_topUp) {
      // Process order payment
      if (transaction.description?.includes("fastfood")) {
        await FastFoodOrderModel.findOneAndUpdate(
          { paymentIds: transaction._id },
          { status: ORDER_STATUS_MESSAGE.PENDING }
        );
      } else {
        await orderModel.findOneAndUpdate(
          { paymentIds: transaction._id },
          { status: ORDER_STATUS_MESSAGE.PENDING }
        );
      }
    }

    return {
      success: true,
      payment_id: paymentId,
      status: "captured",
      amount: payment.amount,
    };
  } catch (error) {
    console.error("Error simulating payment success:", error);
    throw new Error(`Failed to simulate payment success: ${error.message}`);
  }
};

/**
 * Simulate payment failure
 * @param {string} paymentId - Mock payment ID
 * @returns {Promise<Object>} Payment failure response
 */
const simulatePaymentFailure = async (paymentId) => {
  try {
    const payment = await PaymentModel.findOne({ order_id: paymentId });
    if (!payment) {
      throw new Error("Payment not found");
    }

    const transaction = await TransactionModel.findOne({ payment_id: payment._id });
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // Update payment status
    payment.status = "failed";
    payment.payment_confirmed_at = new Date();
    await payment.save();

    // Update transaction status
    transaction.status = TRANSACTION_STATUS.FAILED;
    await transaction.save();

    return {
      success: false,
      payment_id: paymentId,
      status: "failed",
      error: "Payment failed",
    };
  } catch (error) {
    console.error("Error simulating payment failure:", error);
    throw new Error(`Failed to simulate payment failure: ${error.message}`);
  }
};

/**
 * Get mock payment details
 * @param {string} paymentId - Mock payment ID
 * @returns {Promise<Object>} Payment details
 */
const getMockPaymentDetails = async (paymentId) => {
  try {
    const payment = await PaymentModel.findOne({ order_id: paymentId });
    if (!payment) {
      throw new Error("Payment not found");
    }

    return {
      success: true,
      payment: {
        id: payment.order_id,
        status: payment.status,
        amount: payment.amount * 100, // Convert to paise
        currency: "INR",
        created_at: payment.createdAt,
        captured_at: payment.payment_confirmed_at,
      },
    };
  } catch (error) {
    console.error("Error fetching mock payment details:", error);
    throw new Error(`Failed to fetch mock payment details: ${error.message}`);
  }
};

/**
 * Verify mock payment signature
 * @param {string} orderId - Mock order ID
 * @param {string} paymentId - Mock payment ID
 * @param {string} signature - Mock signature
 * @returns {boolean} Always returns true for mock
 */
const verifyMockPaymentSignature = (orderId, paymentId, signature) => {
  // For mock service, always return true
  return true;
};

/**
 * Get mock test card details
 * @returns {Object} Test card details
 */
const getMockTestCardDetails = () => {
  return {
    success: true,
    cards: {
      success: {
        number: "4111 1111 1111 1111",
        cvv: "123",
        expiry: "12/25",
        name: "Test User",
        description: "Successful payment simulation",
      },
      failure: {
        number: "4000 0000 0000 0002",
        cvv: "123",
        expiry: "12/25",
        name: "Test User",
        description: "Payment failure simulation",
      },
      insufficient_funds: {
        number: "4000 0000 0000 9995",
        cvv: "123",
        expiry: "12/25",
        name: "Test User",
        description: "Insufficient funds simulation",
      },
    },
    upi: {
      success: "success@mockrazorpay",
      failure: "failure@mockrazorpay",
    },
    netbanking: {
      success: "SBIN",
      failure: "SBIN",
    },
    instructions: {
      success: "Use this to simulate successful payment",
      failure: "Use this to simulate failed payment",
      test_mode: "This is a mock service for development only",
    },
  };
};

/**
 * Mock webhook processor
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processMockWebhook = async (req, res) => {
  try {
    const { event, payment_id, status } = req.body;

    console.log("Mock webhook received:", { event, payment_id, status });

    if (event === "payment.success" && status === "success") {
      const result = await simulatePaymentSuccess(payment_id);
      return res.status(200).json({
        success: true,
        message: "Mock payment processed successfully",
        data: result,
      });
    } else if (event === "payment.failed" && status === "failed") {
      const result = await simulatePaymentFailure(payment_id);
      return res.status(200).json({
        success: false,
        message: "Mock payment failed",
        data: result,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid mock webhook event",
      });
    }
  } catch (error) {
    console.error("Error processing mock webhook:", error);
    return res.status(500).json({
      success: false,
      message: "Mock webhook processing failed",
      error: error.message,
    });
  }
};

module.exports = {
  createMockPaymentLink,
  simulatePaymentSuccess,
  simulatePaymentFailure,
  getMockPaymentDetails,
  verifyMockPaymentSignature,
  getMockTestCardDetails,
  processMockWebhook,
}; 