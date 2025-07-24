/**
 * @file thal-admin.routes.js
 * @description This file contains the routes for the thal controller
 */

const express = require("express"); // import the express module
const ThalAdminController = require("../../../controllers/admin/thal-admin.controller");
const router = express.Router();

/**
 * Route: /api/v1/admin/thal/create-update
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to create / update a thal
 */
router.post("/create-update", ThalAdminController.setThalOrder);

/**
 * Route to get thal order
 */
router.get("/list", ThalAdminController.getThalOrder);

module.exports = router;