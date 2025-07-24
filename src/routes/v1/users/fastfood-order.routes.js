const express = require("express"); // import the express module
const router = express.Router();
const { authenticate } = require("../../../middleware/auth");
const FastFoodOrderController = require("../../../controllers/users/fastfood-order.controller");

/**
 * @description This route is used to create a new thal order
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */

router.post(
  "/create-order",
  authenticate,
  FastFoodOrderController.placeFastfoodOrder
);

router.get(
  "/check-order-status/:orderId",
  authenticate,
  FastFoodOrderController.getPaymentStatus
);
module.exports = router;
