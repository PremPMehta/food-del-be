const express = require("express"); // import the express module
const AdminAuthController = require("../../../controllers/admin/auth-admin.controller");
const { superAdminAuthenticate } = require("../../../middleware/auth");
const router = express.Router();

/**
 * Route: /api/v1/admin/auth
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to login admin
 */
router.post("/login", AdminAuthController.loginAdminUser);
/**
 * Route to create admin
 */
router.post("/create", superAdminAuthenticate, AdminAuthController.createAdmin);
/**
 * Route to update admin
 */
router.post(
  "/update-admin/:id",
  superAdminAuthenticate,
  AdminAuthController.updateAdmin
);
/**
 * Route to remove admin
 */
router.delete(
  "/remove-admin/:id",
  superAdminAuthenticate,
  AdminAuthController.removeAdmin
);

/**
 * Route to get admin list
 */
router.get("/list", superAdminAuthenticate, AdminAuthController.getAdmins);

/**
 * Route to find admin By id
 */
router.get(
  "/get/:id",
  superAdminAuthenticate,
  AdminAuthController.getAdminById
);

module.exports = router;
