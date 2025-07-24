// Require the Axios library to make HTTP requests
const axios = require("axios");
// Import the mongoose library to interact with the MongoDB database
const mongoose = require("mongoose");

// Load the Mongoose model for the PayPal payment tokens
const PaymentTokenModel = require("../../models/paypalToken.model");

// Load the Mongoose model for the PayPal payment transactions
const PaymentModel = require("../../models/payment.model");

// Load the Mongoose model for the Transaction
const TransactionModel = require("../../models/transaction.model");

// Load the configuration variables for the PayPal API
const {
  PAYPAL_BASE_URL,
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
} = require("../../config/config");
const {
  PAYMENT_METHOD,
  TRANSACTION_TYPE,
  TRANSACTION_STATUS,
} = require("../../utils/constants");

/**
 * Generates a PayPal access token that can be used to make API requests.
 *
 * The access token is obtained by making a POST request to the PayPal
 * OAuth2 token endpoint with the client ID and secret in the
 * Authorization header. The token is then returned in the response.
 *
 * @returns {Promise<string>} The access token.
 *
 * @throws {Error} If there is an error making the request.
 */

const paypalGenerateAccessToken = async () => {
  try {
    // Make a POST request to PayPal's OAuth2 token endpoint
    const response = await axios({
      url: `${PAYPAL_BASE_URL}/v1/oauth2/token`,
      method: "post",
      data: "grant_type=client_credentials",
      // Include client ID and secret in the Authorization header
      auth: {
        username: PAYPAL_CLIENT_ID,
        password: PAYPAL_CLIENT_SECRET,
      },
    });

    // Extract the access token from the response
    const accessToken = response.data.access_token;

    // The number of seconds until the access token expires
    const expiresIn = response.data.expires_in;

    // The date and time when the access token expires
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const payload = {
      token: accessToken,
      expiresAt: expiresAt,
    };

    console.log("------------");
    console.log("paypal token generated : ", payload.token);
    console.log("------------");

    // Use findOneAndUpdate with upsert option
    const record = await PaymentTokenModel.findOneAndUpdate(
      {}, // Empty filter to match any record
      payload, // The data to update or insert
      {
        new: true, // Return the updated document
        upsert: true, // Create a new document if no document matches the filter
      }
    );
  } catch (error) {
    // Log the error and rethrow it
    console.error("Error generating PayPal access token:", error);
    throw error;
  }
};

const paypalCreateOrder = async (data) => {
  // const session = await mongoose.startSession();
  // session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    const paypal_record = await PaymentTokenModel.findOne({});
    // .session(session);

    if (!paypal_record) {
      throw new Error("Paypal token not found");
    }

    console.log("paypal_record.token :> ", paypal_record.token);

    const response = await axios({
      url: `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${paypal_record.token}`,
      },
      data: {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: data.amount?.toFixed(2),
            },
            description: data.order_description,
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
              brand_name: "FOOD DELIVERY APPLICATION",
              locale: "en-US",
              landing_page: "NO_PREFERENCE",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              return_url: data.return_url,
              cancel_url: data.cancel_url,
            },
          },
        },
      },
    });

    const paymentPayloadCreation = {
      order_id: response.data.id,
      user_id: data.user_id,
      description: data.order_description,
      amount: data.amount,
      status: "pending",
      payment_confirmed_at: null,
    };

    const createPayment = await PaymentModel(paymentPayloadCreation);

    await createPayment.save();
    // await createPayment.save({ session });

    const transactionPayloadCreation = {
      payment_id: createPayment._id,
      user_id: data.user_id,
      transaction_type: TRANSACTION_TYPE.CREDIT,
      description: data.order_description,
      payment_method: PAYMENT_METHOD.PAYPAL,
      amount: data.amount,
      status: TRANSACTION_STATUS.PENDING,
      wallet_topUp: data.wallet_topUp ? data.wallet_topUp : false,
    };

    const createTransaction = await TransactionModel(
      transactionPayloadCreation
    );

    await createTransaction.save();
    // await createTransaction.save({ session });

    // // Commit the transaction
    // await session.commitTransaction();
    // session.endSession();

    return {
      createPayment,
      createTransaction,
      payment_link: response.data.links?.find(
        (link) => link.rel === "payer-action"
      ).href,
    };
  } catch (error) {
    // Log the error and rethrow it

    // await session.abortTransaction();
    // session.endSession();

    console.error("Error generating PayPal access token:", error);
    throw error;
  }
  // finally {
  //   // End the transaction
  //   await session.endSession();
  // }
};

async function paypalCapturePayment(captureLink) {
  try {
    const paypal_record = await PaymentTokenModel.findOne({});

    if (!paypal_record) {
      throw new Error("Paypal token not found");
    }

    console.log("paypal_record.token :> ", paypal_record.token);

    const captureResponse = await axios({
      url: captureLink,
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${paypal_record.token}`,
      },
    });
    return captureResponse.data;
  } catch (error) {
    console.error("Error occured capturing payment for paypal :>", error);
    throw error;
  }
}

async function paypalCapturePaymentByAuthorizationId(authorization_id) {
  try {
    const paypal_record = await PaymentTokenModel.findOne({});

    if (!paypal_record) {
      throw new Error("Paypal token not found");
    }

    console.log("paypal_record.token :> ", paypal_record.token);

    const captureResponse = await axios({
      url: `${PAYPAL_BASE_URL}/v2/checkout/orders/${authorization_id}/capture`,
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${paypal_record.token}`,
      },
    });
    return captureResponse.data;
  } catch (error) {
    console.error("Error occured capturing payment for paypal :>", error);
    throw error;
  }
}

async function paypalVerifyWebhook(verificationPayload) {
  try {
    const paypal_record = await PaymentTokenModel.findOne({});

    if (!paypal_record) {
      throw new Error("Paypal token not found");
    }

    console.log("paypal_record.token :> ", paypal_record.token);

    const response = await axios({
      url: PAYPAL_BASE_URL + "/v1/notifications/verify-webhook-signature",
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${paypal_record.token}`,
      },
      data: JSON.stringify(verificationPayload),
    });
    return response.data;
  } catch (error) {
    console.error("Error occured verifying webhook for paypal :>", error);
    throw error;
  }
}

module.exports = {
  paypalGenerateAccessToken,
  paypalCreateOrder,
  paypalVerifyWebhook,
  paypalCapturePayment,
  paypalCapturePaymentByAuthorizationId,
};
