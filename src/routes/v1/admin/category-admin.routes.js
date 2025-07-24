/**
 * @file category-admin.routes.js
 * @description This file contains the routes for the category controller
 */

const express = require("express"); // import the express module
const CategoryAdminController = require("../../../controllers/admin/category-admin.controller");
const router = express.Router();

/**
 * Route: /api/v1/admin/category/create
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to create a new category
 */
router.post("/create", CategoryAdminController.createCategory);

/**
 * Route to update a category
 */
router.post("/update/:id", CategoryAdminController.updateCategory);

/**
 * Route to delete a category
 */
router.delete("/delete/:id", CategoryAdminController.softDeleteCategory);


/**
 * Route to get category by id
 */
router.get("/get/:id", CategoryAdminController.getCategoryById);

/**
 * Route to toggle category status
 */
router.put("/toggle-status/:id", CategoryAdminController.toggleCategoryStatus);


/**
 * Route to get all categories
 */
router.get("/list", CategoryAdminController.getCategories);

/**
 * Route to get all categories - with pagination
 */
router.get("/list/all", CategoryAdminController.getAllCategories);

module.exports = router;