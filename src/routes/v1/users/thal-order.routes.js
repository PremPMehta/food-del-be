const express = require("express"); // import the express module
const OrderThalController = require("../../../controllers/users/thal-order.controller");
const { authenticate } = require("../../../middleware/auth");
const router = express.Router();
/**
 * Route: /api/v1/users
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to create a new user
 */
router.get("/get-order/:type", authenticate, OrderThalController.getAllOrders);
/**
 * Route to create a new user
 */
router.get(
  "/get-order/:type/:id",
  authenticate,
  OrderThalController.getAllOrderById
);

module.exports = router;
