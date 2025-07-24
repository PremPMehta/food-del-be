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
router.post("/razorpay-webhook", razorpayVerifyWebhook);

// router.post(
//   "/create-payment",
//   authenticate,
//   PaymentController.razorpayCreatePayment
// );

module.exports = router;
