const express = require("express"); // import the express module
const router = express.Router();    
const UserRoutes = require("./users/index.routes.js");
const AdminRoutes = require("./admin/index-admin.routes.js");

router.use("/admin", AdminRoutes);

router.use("/users", UserRoutes);   

module.exports = router;