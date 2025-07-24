/**
 * @file user-admin.routes.js
 * @description This file contains the routes for the user admin controller
 */

const express = require("express"); // import the express module
const UserAdminController = require("../../../controllers/admin/user-admin.controller");
const router = express.Router();


/**
 * Route to get user by id 
 */
router.get("/get/:id" , UserAdminController.getUserById);


/**
 * Route to update a user
 */
router.post("/update/:id", UserAdminController.updateUser);

/**
 * Route to delete a user
 */
router.delete("/delete/:id", UserAdminController.softDeleteUser);

/**
 * Route to toggle the status of a user
 */
router.put("/toggle-status/:id", UserAdminController.toggleUserStatus);

/**
 * Route to update the wallet balance of a user
 */
router.post("/update-wallet-balance/:id", UserAdminController.updateUserWalletBalance);

/**
 * Route to update the user's prime membership status
 */
router.post("/toggle-prime-membership/:id", UserAdminController.toggleUserPrimeMember);

/**
 * Route to list all users
 */
router.get("/list", UserAdminController.getUsers);

module.exports = router;
