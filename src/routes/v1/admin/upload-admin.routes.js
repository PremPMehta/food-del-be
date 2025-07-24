const express = require("express"); // import the express module
const UploadAdminController = require("../../../controllers/admin/upload-admin.controller");
const router = express.Router();
const { uploadFile } = require("../../../services/upload/upload");
/**
 * Route: /api/v1/admin/asset-upload
 * @param {*} app
 * @param {*} router
 */

/**
 * Route to upload file
 */
router.post("/assets", uploadFile, UploadAdminController.uploadAssetFile);

module.exports = router;