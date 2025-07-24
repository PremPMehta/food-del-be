const express = require("express"); // import the express module
const AddressController = require("../../../controllers/users/address.controller");
const { authenticate } = require("../../../middleware/auth");
const router = express.Router();
/**
 * Route: /api/v1/users
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to create a new user
 */
router.post("/create", authenticate, AddressController.createAddress);
/**
 * Route to create a new user
 */
router.post("/update/:id", authenticate, AddressController.updateAddress);
/**
 * Route to create a new user
 */
router.delete("/delete/:id", authenticate, AddressController.deleteAddress);
/**
 * Route to create a new user
 */
router.get("/get", authenticate, AddressController.addressList);

module.exports = router;
