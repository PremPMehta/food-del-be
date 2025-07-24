/**
 * @file thal.routes.js
 * @description This file contains the routes for the thal controller
 */

const express = require("express");
const router = express.Router();
const { authenticate } = require("../../../middleware/auth");
const ThalController = require("../../../controllers/users/thal.controller")

/**
 * @description This route is used to get the thal list
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */

router.get('/start-category' , authenticate , ThalController.startThalCategory);

/**
 * @description This route is used to get the next thal category
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */

router.get('/next-category/:orderId' , authenticate , ThalController.nextThalCategory);


/**
 * @description This route is used to get the previous thal category
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */

router.get('/previous-category/:orderId' , authenticate , ThalController.previousThalCategory)

/**
 * @description This route is used to get the thal category by id
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */

router.get('/category/:orderId' , authenticate , ThalController.getThalCategoryById);

module.exports = router;