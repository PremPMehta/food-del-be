const express = require("express"); // import the express module
const router = express.Router();
const { authenticate } = require("../../../middleware/auth");
const MembershipController = require("../../../controllers/users/membership.controller");


/**
 * @description This route is used to check the membership status of a user
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */

router.get("/check-membership-status", authenticate , MembershipController.checkMembershipStatus);

/**
 * @description This route is used to subscribe a user to a membership plan
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */

router.post("/subscribe", authenticate , MembershipController.subscribeToMembership);

/**
 * @description This route is used to verify a payment token for membership
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.post("/verify-membership-payment-token" , MembershipController.verifyMembershipPaymentToken);

module.exports = router;