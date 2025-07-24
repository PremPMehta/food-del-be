/**
 * @file thal.routes.js
 * @description This file contains the routes for the thal controller
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../../../middleware/auth");
const FastfoodController = require("../../../controllers/users/fastfood.controller");

/**
 * @description This route is used to get the thal list
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */

router.get("/get-fastfood", authenticate, FastfoodController.getFastfoods);
router.get(
  "/get-veg-fastfood",
  authenticate,
  FastfoodController.getVegFastfoods
);

router.post(
  "/get-fastfood-dishes/:id",
  authenticate,
  FastfoodController.getFastfoodsDish
);
router.get(
  "/get-popular",
  authenticate,
  FastfoodController.popularFastFood
);

module.exports = router;
