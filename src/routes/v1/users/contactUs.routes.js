const express = require("express"); // import the express module
const ContactUsController = require("../../../controllers/users/contactUs.controller");
const router = express.Router();
/**
 * Route: /api/v1/users
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to create a new Address
 */
router.post("/create", ContactUsController.ContactUs);

module.exports = router;
