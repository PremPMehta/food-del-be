/**
 * The PaypalToken model represents a token that can be used to authenticate
 * with the PayPal API.
 *
 * @typedef {Object} PaypalToken
 * @property {string} token - The token that can be used to authenticate with the PayPal API.
 * @property {Date} expiresAt - The date and time at which the token will expire.
 */

const mongoose = require("mongoose");

/**
 * The schema for the PaypalToken model.
 */
const paypalTokenSchema = new mongoose.Schema(
  {
    /**
     * The token that can be used to authenticate with the PayPal API.
     */
    token: {
      type: String,
      required: true,
    },
    /**
     * The date and time at which the token will expire.
     */
    expiresAt: {
      type: Date,
      required: true,
      /**
       * The default value for the expiresAt field is the current date and time
       * plus 24 hours.
       */
      default: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    },
  },
  {
    /**
     * Enable timestamps for the model.
     */
    timestamps: true,
  }
);

/**
 * The model for the PaypalToken schema.
 */
const PaypalToken = mongoose.model("PaypalToken", paypalTokenSchema);

module.exports = PaypalToken;

