const express = require("express"); // import the express module
const UserAuthController = require("../../../controllers/users/auth.controller");
const ForgotPassword = require("../../../controllers/users/forgot.controller");
const router = express.Router();
/**
 * Route: /api/v1/users
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to create a new user
 */
router.post("/register", UserAuthController.registerUser);

/**
 * Route to login user
 */
router.post("/login", UserAuthController.loginUser);

/**
 * Route to forget password
 */
router.post("/forget-password", ForgotPassword.forgotPassword);

/**
 * Route to reset password
 */
router.post("/reset-password/:token", ForgotPassword.forgetChangePassword);

module.exports = router;
