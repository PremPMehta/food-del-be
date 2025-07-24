const express = require("express"); // import the express module
const AdsController = require("../../../controllers/users/ads.controller");
const { authenticate } = require("../../../middleware/auth");
const router = express.Router();
/**
 * Route: /api/v1/users
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to upadte messages
 */
router.get("/list-ads", authenticate, AdsController.ListAds);
/**
 * Route to upadte messages
 */
router.get("/get-ads/:id", authenticate, AdsController.getAdsById);

module.exports = router;
