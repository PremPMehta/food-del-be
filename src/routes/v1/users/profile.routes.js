/**
 * @file profile.routes.js
 * @description This file contains the routes for the profile controller
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../../../middleware/auth");
const ProfileController = require("../../../controllers/users/profile.controller");

/**
 * @description This route is used to update the user profile
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */

router.post("/update-profile", authenticate , ProfileController.updateUserProfile);

/**
 * @description This route is used to update the user password
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */

router.post("/update-password", authenticate , ProfileController.updateUserPassword);

module.exports = router;