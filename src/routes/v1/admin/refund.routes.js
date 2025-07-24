const express = require("express"); // import the express module
const RefundController = require("../../../controllers/admin/payment-refund.controller");
const router = express.Router();
/**
 * Route: /api/v1/users
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to upadte messages
 */
router.post("/refund-amount/:type/:id", RefundController.refundAmount);

module.exports = router;
