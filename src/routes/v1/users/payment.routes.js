/**
 * @file payment.routes.js
 * @description This file contains the routes for the payment controller
 */

const express = require("express"); // import the express module
const PaymentController = require("../../../controllers/users/payment.controller");
const router = express.Router();
const { authenticate } = require("../../../middleware/auth");
const {
  razorpayVerifyWebhook,
} = require("../../../services/razorpay/razorpay");

/**
 * @description This route is used to verify a payment token
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
// router.post("/verify-signup-payment-token", authenticate , PaymentController.verifySignupPaymentToken);

/**
 * @description This route is used to verify a payment token
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.post("/verify-payment-token", PaymentController.verifyPaymentToken);

/**
 * @description This route is used to verify a payment token
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.post("/paypal-webhook", PaymentController.paypalWebhook);

/**
 * @description Razorpay webhook endpoint
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.post("/razorpay-webhook", razorpayVerifyWebhook);

/**
 * @description Create wallet top-up payment
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.post("/wallet-topup", authenticate, PaymentController.createWalletTopUpPayment);

/**
 * @description Create prime membership payment
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.post("/prime-membership", authenticate, PaymentController.createPrimeMembershipPayment);

/**
 * @description Create order payment
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.post("/order-payment", authenticate, PaymentController.createOrderPayment);

/**
 * @description Verify Razorpay payment manually
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.post("/verify-razorpay", authenticate, PaymentController.verifyRazorpayPayment);

/**
 * @description Get payment status
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.get("/status/:payment_id", authenticate, PaymentController.getPaymentStatus);

/**
 * @description Get test card details for sandbox testing
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.get("/test-cards", PaymentController.getTestCards);

/**
 * @description Refund payment
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.post("/refund", authenticate, PaymentController.refundPayment);

// Legacy route for backward compatibility
// router.post(
//   "/create-payment",
//   authenticate,
//   PaymentController.razorpayCreatePayment
// );

module.exports = router;
