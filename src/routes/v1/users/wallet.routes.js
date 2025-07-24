const express = require("express"); // import the express module
const router = express.Router();
const { authenticate } = require("../../../middleware/auth");
const WalletController = require("../../../controllers/users/wallet.controller");

/**
 * @description This route is used to create a new wallet
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */

router.post("/top-up", authenticate , WalletController.walletTopUp);

/**
 * @description This route is used to get the wallet balance
 * @param {object} req - The request object
 * @param {object} res - The response object
 * @returns {Promise<void>}
 */
router.get("/balance", authenticate , WalletController.getWalletBalance);

module.exports = router;