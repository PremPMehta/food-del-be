/**
 * @file thal-order-admin.routes.js
 * @description This file contains the routes for the thal order admin controller
 */

const express = require("express"); // import the express module
const ThalOrderAdminController = require("../../../controllers/admin/thal-order-admin.controller");
const router = express.Router();

/**
 * Route: /api/v1/admin/thal-order
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to get thal order
 */
router.get("/thal-list", ThalOrderAdminController.getThalOrders);

/**
 * Route to get thal order by id
 */
router.get("/get-thal-order/:id", ThalOrderAdminController.getThalOrderById);

/**
 * Route to update status of order by id 
 */
router.post("/update-thal-order-status/:id", ThalOrderAdminController.updateThalOrderStatus);

module.exports = router;