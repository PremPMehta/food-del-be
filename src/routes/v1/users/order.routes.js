const express = require("express"); // import the express module
const router = express.Router();
const { authenticate } = require("../../../middleware/auth");
const OrderController = require("../../../controllers/users/order.controller");

/**
 * @description This route is used to create a new thal order
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */

router.post("/create-thal-order", authenticate, OrderController.placeThalOrder);

/**
 * @description This route is used to list orders placed by a user
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */

router.get("/list-orders", authenticate, OrderController.listUserOrders);
router.get(
  "/check-thal-order-status/:orderId",
  authenticate,
  OrderController.getThalPaymentStatus
);

module.exports = router;
