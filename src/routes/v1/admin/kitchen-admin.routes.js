/**
 * @file dish-admin.routes.js
 * @description This file contains the routes for the dish admin controller
 */

const express = require("express"); // import the express module
const kitchenController = require("../../../controllers/admin/kitchen.controller");
const router = express.Router();

/**
 * Route: /api/v1/admin/dish/create
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to create a new kitchen
 */
router.post("/create", kitchenController.addKitchen);
/**
 * Route to upadte  kitchen
 */
router.post("/update/:id", kitchenController.updateKitchen);
/**
 * Route to remove  kitchen
 */
router.delete("/delete/:id", kitchenController.removeKitchen);

/**
 * Route to get all kitchens
 */
router.get("/list/all", kitchenController.getAllKitchen);

/**
 * Route to get kitchens list - paginated
 */
router.get("/list", kitchenController.getKitchens);

/**
 * Route to get kitchen by id
 */
router.get("/get/:id", kitchenController.getKitchenById);
module.exports = router;
