/**
 * @file transactions-admin.routes.js
 * @description This file contains the routes for the transactions admin controller
 */

const express = require("express"); // import the express module
const TransactionsAdminController = require("../../../controllers/admin/transactions-admin.controller");
const router = express.Router();

/**
 * Route: /api/v1/admin/transactions
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to get transactions
 */
router.get("/list", TransactionsAdminController.getTransactions);

module.exports = router;