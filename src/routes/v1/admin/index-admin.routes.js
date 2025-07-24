const express = require("express"); // import the express module
const router = express.Router(); // create a new express router object

// Require the routes for the admin module
const AdminAuthRoutes = require("./auth-admin.routes.js"); // admin authentication routes
const UploadAssetRoutes = require("./upload-admin.routes.js"); // upload asset routes
const DishRoutes = require("./dish-admin.routes.js"); // dish routes
const CategoryRoutes = require("./category-admin.routes.js"); // category routes
const UserRoutes = require("./user-admin.routes.js"); // user routes
const ReferralSettingsRoutes = require("./referral-settings-admin.routes.js"); // referral settings routes
const ThalRoutes = require("./thal-admin.routes.js"); // thal routes
const OrderRoutes = require("./thal-order-admin.routes.js"); // order routes
const TransactionsRoutes = require("./transactions-admin.routes.js"); // transactions routes
const KitchenRoutes = require("./kitchen-admin.routes.js");
const ComboRoutes = require("./combo-meal.routes.js");
const FastFoodOrder = require("./fastFoodOrder.routes.js");
const ContactUs = require("./contactUs.routes.js");
const Ads = require("./ads.routes.js");
const Refund = require("./refund.routes.js");
// Require the middleware for authentication
const { adminAuthenticate } = require("../../../middleware/auth.js"); // admin authentication middleware

// Use the admin authentication middleware to protect the routes
router.use("/dish", adminAuthenticate, DishRoutes); // protect the dish routes
router.use("/category", adminAuthenticate, CategoryRoutes); // protect the category routes
router.use("/user", adminAuthenticate, UserRoutes); // protect the user routes
router.use("/upload", adminAuthenticate, UploadAssetRoutes); // protect the upload routes
router.use("/referral-settings", adminAuthenticate, ReferralSettingsRoutes);
router.use("/thal", adminAuthenticate, ThalRoutes); // protect the thal routes
router.use("/order", adminAuthenticate, OrderRoutes); // protect the order routes
router.use("/transactions", adminAuthenticate, TransactionsRoutes); // protect the transactions routes
router.use("/kitchen", adminAuthenticate, KitchenRoutes); // protect the transactions routes
router.use("/combo-meal", adminAuthenticate, ComboRoutes); // protect the transactions routes
router.use("/fastFoodOrder", adminAuthenticate, FastFoodOrder); // protect the transactions routes
router.use("/contact-us", adminAuthenticate, ContactUs); // protect the transactions routes
router.use("/ads", adminAuthenticate, Ads); // protect the transactions routes
router.use("/refund", adminAuthenticate, Refund); // protect the transactions routes

// Use the admin authentication routes
router.use("/auth", AdminAuthRoutes);

// Export the admin router
module.exports = router;
