/**
 * @file payment-test.routes.js
 * @description Testing routes for payment functionality (development only)
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../../../middleware/auth");
const {
  createMockPaymentLink,
  simulatePaymentSuccess,
  simulatePaymentFailure,
  getMockPaymentDetails,
  processMockWebhook,
} = require("../../../services/razorpay/mock-razorpay");

/**
 * @description Create mock wallet top-up payment (for testing)
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.post("/mock/wallet-topup", authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    const paymentData = {
      amount: amount,
      currency: "INR",
      description: `Mock Wallet top-up of ₹${amount}`,
      user_id: userId,
      callback_url: "https://mock-razorpay.com/callback",
      callback_method: "get",
      wallet_topUp: true,
      customer: {
        name: req.user.name,
        email: req.user.email,
        contact: req.user.phone,
      },
    };

    const result = await createMockPaymentLink(paymentData);

    res.status(200).json({
      success: true,
      message: "Mock payment link created successfully",
      data: {
        payment_link: result.payment_link,
        payment_id: result.payment_id,
        amount: amount,
        test_instructions: "Use the simulate endpoints to test payment success/failure",
      },
    });
  } catch (error) {
    console.error("Error creating mock wallet top-up payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create mock payment link",
      error: error.message,
    });
  }
});

/**
 * @description Create mock prime membership payment (for testing)
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.post("/mock/prime-membership", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await require("../../../models/users.model").findById(userId);

    if (user.isPrimeMember) {
      return res.status(400).json({
        success: false,
        message: "User is already a prime member",
      });
    }

    const paymentData = {
      amount: 999,
      currency: "INR",
      description: "Mock Prime Membership (30 days)",
      user_id: userId,
      callback_url: "https://mock-razorpay.com/callback",
      callback_method: "get",
      customer: {
        name: user.name,
        email: user.email,
        contact: user.phone,
      },
    };

    const result = await createMockPaymentLink(paymentData);

    res.status(200).json({
      success: true,
      message: "Mock prime membership payment link created successfully",
      data: {
        payment_link: result.payment_link,
        payment_id: result.payment_id,
        amount: paymentData.amount,
        test_instructions: "Use the simulate endpoints to test payment success/failure",
      },
    });
  } catch (error) {
    console.error("Error creating mock prime membership payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create mock payment link",
      error: error.message,
    });
  }
});

/**
 * @description Create mock order payment (for testing)
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.post("/mock/order-payment", authenticate, async (req, res) => {
  try {
    const { amount, orderId, orderType = "thal" } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const paymentData = {
      amount: amount,
      currency: "INR",
      description: `Mock Payment for ${orderType} order - ${orderId}`,
      user_id: userId,
      callback_url: "https://mock-razorpay.com/callback",
      callback_method: "get",
      order_topUp: true,
      customer: {
        name: req.user.name,
        email: req.user.email,
        contact: req.user.phone,
      },
      notes: {
        order_id: orderId,
        order_type: orderType,
      },
    };

    const result = await createMockPaymentLink(paymentData);

    res.status(200).json({
      success: true,
      message: "Mock order payment link created successfully",
      data: {
        payment_link: result.payment_link,
        payment_id: result.payment_id,
        amount: amount,
        order_id: orderId,
        test_instructions: "Use the simulate endpoints to test payment success/failure",
      },
    });
  } catch (error) {
    console.error("Error creating mock order payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create mock payment link",
      error: error.message,
    });
  }
});

/**
 * @description Simulate payment success (for testing)
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.post("/mock/simulate-success", async (req, res) => {
  try {
    const { payment_id } = req.body;

    if (!payment_id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    const result = await simulatePaymentSuccess(payment_id);

    res.status(200).json({
      success: true,
      message: "Payment success simulated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error simulating payment success:", error);
    res.status(500).json({
      success: false,
      message: "Failed to simulate payment success",
      error: error.message,
    });
  }
});

/**
 * @description Simulate payment failure (for testing)
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.post("/mock/simulate-failure", async (req, res) => {
  try {
    const { payment_id } = req.body;

    if (!payment_id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    const result = await simulatePaymentFailure(payment_id);

    res.status(200).json({
      success: false,
      message: "Payment failure simulated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error simulating payment failure:", error);
    res.status(500).json({
      success: false,
      message: "Failed to simulate payment failure",
      error: error.message,
    });
  }
});

/**
 * @description Get mock payment details (for testing)
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.get("/mock/payment/:payment_id", async (req, res) => {
  try {
    const { payment_id } = req.params;

    const result = await getMockPaymentDetails(payment_id);

    res.status(200).json({
      success: true,
      message: "Mock payment details retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching mock payment details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch mock payment details",
      error: error.message,
    });
  }
});

/**
 * @description Mock webhook endpoint (for testing)
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.post("/mock/webhook", processMockWebhook);

/**
 * @description Get testing instructions (for testing)
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.get("/mock/instructions", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Mock payment testing instructions",
    data: {
      endpoints: {
        "Create Wallet Top-up": "POST /api/v1/users/payment-test/mock/wallet-topup",
        "Create Prime Membership": "POST /api/v1/users/payment-test/mock/prime-membership",
        "Create Order Payment": "POST /api/v1/users/payment-test/mock/order-payment",
        "Simulate Success": "POST /api/v1/users/payment-test/mock/simulate-success",
        "Simulate Failure": "POST /api/v1/users/payment-test/mock/simulate-failure",
        "Get Payment Details": "GET /api/v1/users/payment-test/mock/payment/:payment_id",
        "Mock Webhook": "POST /api/v1/users/payment-test/mock/webhook",
      },
      testing_flow: [
        "1. Create a payment using any of the create endpoints",
        "2. Copy the payment_id from the response",
        "3. Use simulate-success or simulate-failure to test payment processing",
        "4. Check payment status using get payment details endpoint",
        "5. Verify database updates (wallet balance, order status, etc.)",
      ],
      webhook_testing: {
        success: {
          event: "payment.success",
          payment_id: "your_payment_id",
          status: "success",
        },
        failure: {
          event: "payment.failed",
          payment_id: "your_payment_id",
          status: "failed",
        },
      },
    },
  });
});

module.exports = router; 