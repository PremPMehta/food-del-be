/**
 * @file referral-settings-admin.routes.js
 * @description This file contains the routes for the referral settings controller
 */

const express = require("express"); // import the express module
const ReferralSettingsAdminController = require("../../../controllers/admin/referral-settings-admin.controller");
const { adminAuthenticate } = require("../../../middleware/auth");
const router = express.Router();

/**
 * Route: /api/v1/admin/referral-settings
 * @param {*} app
 * @param {*} router
 */

// /**
//  * Route to get referral settings
//  */
router.get("/list", ReferralSettingsAdminController.getAllReferralSettings);

/**
 * Route to update referral settings
 */
router.post("/create-update", ReferralSettingsAdminController.createUpdateReferralSettings);
/**
 * Route to get the user
 */
router.get("/list",  adminAuthenticate,ReferralSettingsAdminController.allUSer);
/**
 * Route to admin can Credit bonus to referral user  
 */
router.post("/credit-bonus",adminAuthenticate, ReferralSettingsAdminController.provideDirectReferralBonus);

module.exports = router;