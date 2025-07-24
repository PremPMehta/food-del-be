const express = require("express"); // import the express module
const ContactUsController = require("../../../controllers/admin/contactUs.controller");
const router = express.Router();
/**
 * Route: /api/v1/users
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to upadte messages
 */
router.get("/get-contact", ContactUsController.getAllMessages);
/**
 * Route to upadte messages
 */
router.post("/update-contact/:id", ContactUsController.updateMessage);
/**
 * Route to upadte messages
 */
router.delete("/delete-contact/:id", ContactUsController.deleteMessage);

module.exports = router;
