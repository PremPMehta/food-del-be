const express = require("express"); // import the express module
const router = express.Router();
const v1Routes = require("./v1/v1.routes");
/**
 * Route: /api/v1
 * @param {*} app
 * @param {*} router
 */
router.use("/v1" , v1Routes);

module.exports = router;