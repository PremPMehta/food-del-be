const express = require("express"); // import the express module
const router = express.Router();

const AuthRoutes = require("./auth.routes.js");
const PaymentRoutes = require("./payment.routes.js");
const WalletRoutes = require("./wallet.routes.js");
const MembershipRoutes = require("./membership.routes.js");
const ThalRoutes = require("./thal.routes.js");
const OrderRoutes = require("./order.routes.js");
const ProfileRoutes = require("./profile.routes.js");
const FastfoodRoutes = require("./fastfood.routes.js");
const LoactionRoutes = require("./location.routes.js");
const ContactUsRoutes = require("./contactUs.routes.js");
const AddressRoutes = require("./address.routes.js");
const ThalOrderRoutes = require("./thal-order.routes.js");
const Ads = require("./ads.routes.js");

const FastFoodOrderRoutes = require("./fastfood-order.routes.js");

router.use("/auth", AuthRoutes);

router.use("/payment", PaymentRoutes);

router.use("/wallet", WalletRoutes);

router.use("/membership", MembershipRoutes);

router.use("/thal-category", ThalRoutes);

router.use("/order", OrderRoutes);

router.use("/profile", ProfileRoutes);

router.use("/fastfood", FastfoodRoutes);

router.use("/location", LoactionRoutes);

router.use("/fastfood-order", FastFoodOrderRoutes);

router.use("/contact-us", ContactUsRoutes);

router.use("/address", AddressRoutes);

router.use("/all-order", ThalOrderRoutes);

router.use("/ads", Ads);

module.exports = router;
