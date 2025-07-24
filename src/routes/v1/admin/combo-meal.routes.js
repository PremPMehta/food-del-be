/**
 * @file combo-meal.routes.js
 * @description This file contains the routes for the combo meal admin controller
 */

const express = require("express"); // import the express module
const comboMealController = require("../../../controllers/admin/combo-meal.controller");
const router = express.Router();

/**
 * Route: /api/v1/admin/combo/create
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to create a new combo meal
 */
router.post("/create", comboMealController.createCombo);
/**
 * Route to upadte  combo meal
 */
router.post("/update/:id", comboMealController.updateCombo);
/**
 * Route to remove  kitchen
 */
router.delete("/delete/:id", comboMealController.removeCombo);

/**
 * Route to get combo meal
 */
router.get("/list", comboMealController.getCombos);

/**
 * Route to get combo meal by id
 */
router.get("/get/:id", comboMealController.getComboById);

/**
 * Route to get kitchen
 */
// router.get("/getAllKitech", kitchencontroller.getKitchen);

module.exports = router;
