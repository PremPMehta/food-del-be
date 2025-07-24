/**
 * @file Location.routes.js
 * @description This file contains the routes for the dish admin controller
 */

const express = require("express"); // import the express module
const locationController = require("../../../controllers/users/location.controller");
const router = express.Router();

/**
 * Route: /api/v1/admin/dish/create
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to create a new kitchen
 */
router.post("/find", locationController.locationData);

module.exports = router;
