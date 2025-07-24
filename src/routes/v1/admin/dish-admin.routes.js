/**
 * @file dish-admin.routes.js
 * @description This file contains the routes for the dish admin controller
 */

const express = require("express"); // import the express module
const DishAdminController = require("../../../controllers/admin/dish-admin.controller");
const router = express.Router();

/**
 * Route: /api/v1/admin/dish/create
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to create a new dish
 */
router.post("/create", DishAdminController.createDish);

/**
 * Route to update a dish
 */
router.post("/update/:id", DishAdminController.updateDish);

/**
 * Route to delete a dish
 */
router.delete("/delete/:id", DishAdminController.softDeleteDish);

/**
 * Route to get dish by id
 */
router.get("/get/:id", DishAdminController.getDishById);

/**
 * Route to toggle dish status
 */
router.put("/toggle-status/:id", DishAdminController.toggleDishStatus);

/**
 * Route to get all dishes
 */
router.get("/list", DishAdminController.getDishes);

/**
 * Route to get all dishes - without pagination
 */
router.get("/list/all", DishAdminController.getAllDishes);

module.exports = router;
