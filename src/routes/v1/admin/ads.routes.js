const express = require("express"); // import the express module
const AdsController = require("../../../controllers/admin/ads.controller");
const router = express.Router();
/**
 * Route: /api/v1/users
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to upadte messages
 */
router.get("/list-ads", AdsController.listAds);
/**
 * Route to upadte messages
 */
router.post("/create-ads", AdsController.createAds);
/**
 * Route to upadte messages
 */
router.post("/update-ads/:id", AdsController.updateAds);
/**
 * Route to upadte messages
 */
router.delete("/delete-ads/:id", AdsController.removeAds);

module.exports = router;
