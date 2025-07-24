/**
 * @file FastFood-order-admin.routes.js
 * @description This file contains the routes for the FastFood order admin controller
 */

const express = require("express"); // import the express module
const FastFoodOrderAdminController = require("../../../controllers/admin/fastFoodOrder.controller");
const { adminAuthenticate } = require("../../../middleware/auth");
const router = express.Router();

/**
 * Route: /api/v1/admin/FastFood-order
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to get FastFood order
 */
router.get(
  "/fastFood-list",
  adminAuthenticate,
  FastFoodOrderAdminController.getFastFoodOrders
);

/**
 * Route to get FastFood order by id
 */
router.get(
  "/get-fastFood-order/:id",
  FastFoodOrderAdminController.getFastFoodOrderById
);

/**
 * Route to update status of order by id
 */
router.post(
  "/update-fastFood-order-status/:id",
  FastFoodOrderAdminController.updateFasFoodOrderStatus
);

module.exports = router;
