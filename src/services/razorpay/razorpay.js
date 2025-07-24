const Razorpay = require("razorpay");
const crypto = require("crypto");
const {
  validateWebhookSignature,
} = require("razorpay/dist/utils/razorpay-utils");
// Require the Axios library to make HTTP requests
const axios = require("axios");
// Import the mongoose library to interact with the MongoDB database
const mongoose = require("mongoose");

// Load the Mongoose model for the PayPal payment transactions
const PaymentModel = require("../../models/payment.model");
const UserModel = require("../../models/users.model");

// Load the Mongoose model for the Transaction
const TransactionModel = require("../../models/transaction.model");
const orderModel = require("../../models/order.model");

// Load the configuration variables for the PayPal API
const {
  RAZORPAY_ID_KEY,
  RAZORPAY_SECRET_KEY,
  WEBHOOK_SECRET,
  PRIME_MEMBERSHIP_AMOUNT,
} = require("../../config/config");
const {
  PAYMENT_METHOD,
  TRANSACTION_TYPE,
  TRANSACTION_STATUS,
  ORDER_STATUS,
  ORDER_STATUS_MESSAGE,
} = require("../../utils/constants");
const FastFoodOrderModel = require("../../models/fastfood-order.model");
const ReferralSettingsModel = require("../../models/referral-settings.model");
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

const razorpayInstance = new Razorpay({
  key_id: RAZORPAY_ID_KEY,
  key_secret: RAZORPAY_SECRET_KEY,
});

const createRazorpayOrder = async (data) => {
  try {
    const paymentLink = await razorpayInstance.paymentLink.create({
      amount: Math.round(data.amount * 100), // Amount in paise
      currency: "INR",
      description: data.order_description,
      //   customer: {
      //     name: data.customer_name, // Optional: Customer's name
      //     email: data.customer_email, // Optional: Customer's email
      //     contact: data.customer_contact, // Optional: Customer's contact
      //   },
      notify: {
        sms: true, // Notify customer via SMS
        email: true, // Notify customer via email
      },
      callback_url: data.return_url, // URL to redirect to after payment
      callback_method: "get",
      //   partial_payment: false,
      notes: {
        user_id: data.user_id,
        description: data.order_description,
      },
    });

    // Step 2: Save payment record in your database
    const paymentPayloadCreation = {
      order_id: paymentLink.id,
      user_id: data.user_id,
      description: data.order_description,
      amount: data.amount,
      status: "pending",
      payment_confirmed_at: null,
    };

    const createPayment = new PaymentModel(paymentPayloadCreation);
    await createPayment.save();

    // Step 3: Save transaction record in your database
    const transactionPayloadCreation = {
      payment_id: createPayment._id,
      user_id: data.user_id,
      transaction_type: TRANSACTION_TYPE.CREDIT,
      description: data.order_description,
      payment_method: PAYMENT_METHOD.RAZORPAY,
      amount: data.amount,
      status: TRANSACTION_STATUS.PENDING,
      wallet_topUp: data.wallet_topUp || false,
      order_topUp: data.order_topUp || false,
    };

    const createTransaction = new TransactionModel(transactionPayloadCreation);
    await createTransaction.save();

    // Step 4: Return the Razorpay payment link
    return {
      createPayment,
      createTransaction,
      payment_link: paymentLink.short_url, // Short payment link from Razorpay
    };
  } catch (error) {
    // Log the error and rethrow it
    console.error("Error creating Razorpay order:", error);
    throw error;
  }
};

const razorpayVerifyWebhook = async (req, res) => {
  const session = await mongoose.startSession(); // Start a session
  session.startTransaction(); // Start the transaction

  try {
    const razorpaySignature = req.headers["x-razorpay-signature"];

    if (!razorpaySignature) {
      return res.status(400).send("Signature not found");
    }

    console.log(JSON.stringify(req.body));

    const isValidCheck = await validateWebhookSignature(
      JSON.stringify(req.body),
      razorpaySignature,
      WEBHOOK_SECRET
    );

    if (isValidCheck) {
      const { event, payload } = req.body;

      console.log("event", event);

      if (event === ORDER_STATUS.PAID) {
        const paymentLinkId = payload.payment_link?.entity?.order_id;
        const paymentId = payload?.payment_link?.entity.id;
        const amountPaid = payload?.payment_link?.entity?.amount_paid;

        const payment = await PaymentModel.findOne({
          order_id: paymentId,
          payment_confirmed_at: null,
        }).session(session); // Use session for transaction

        console.log("---------------->", payment);

        if (amountPaid !== payment.amount * 100) {
          await session.abortTransaction(); // Abort transaction on error
          return res.status(400).json({
            message: "Amount paid does not match to amount link created for.",
          });
        }

        const transaction = await TransactionModel.findOne({
          payment_id: payment._id,
        }).session(session); // Use session for transaction

        if (!transaction) {
          await session.abortTransaction(); // Abort transaction on error
          session.endSession();
          return res.status(404).json({
            message: "Transaction not found.",
          });
        } else if (transaction.status !== TRANSACTION_STATUS.PENDING) {
          await session.abortTransaction();
          session.endSession();
          return res.status(200).json({
            message: "Transaction already updated.",
          });
        }

        if (transaction.payment_method === "razorpay") {
          const user = await UserModel.findOne({
            _id: transaction.user_id,
          }).session(session);

          if (transaction.wallet_topUp === true) {
            await TransactionModel.findOneAndUpdate(
              { payment_id: payment._id },
              { status: TRANSACTION_STATUS.COMPLETED },
              { session } // Use session for transaction
            );

            const paymentHistoryRecord = {
              payment_id: paymentId,
              reference_id: payment._id,
              amount: transaction.amount,
              transaction_id: transaction._id,
              starting_balance: user.walletBalance,
              transaction_type: TRANSACTION_TYPE.CREDIT,
              closing_balance: user.walletBalance + transaction.amount,
              description: transaction.description,
              timestamp: Date.now(),
            };

            user.paymentHistory.unshift(paymentHistoryRecord);

            user.walletBalance += amountPaid / 100;

            await PaymentModel.findOneAndUpdate(
              { order_id: paymentId },
              {
                status: TRANSACTION_STATUS.COMPLETED,
                payment_confirmed_at: new Date(),
              },
              { session } // Use session for transaction
            );

            // if (user.referralParents && user.referralParents.length > 0) {
            //   // fetch the referrer settings
            //   const referrerSettings = await ReferralSettingsModel.find(
            //     {},
            //     {},
            //     {
            //       session,
            //     }
            //   );

            //   if (!referrerSettings) {
            //     console.log("No Referrer settings not found");
            //   }

            //   // for each referral parent run the async function one after another
            //   for (const parent of user.referralParents) {
            //     const parentUser = await UserModel.findOne(
            //       { _id: parent?.userId },
            //       {},
            //       {
            //         session,
            //       }
            //     );

            //     if (parentUser && parentUser.isPrimeMember) {
            //       // Calculate the reward amount on the payment description
            //       let rewardAmount = 0;

            //       const applicableSetting = referrerSettings.find(
            //         (setting) => setting.level === parent.level
            //       );

            //       // Check if t he payment description contains "signup"
            //       if (payment.description.toLowerCase().includes("prime")) {
            //         // Use signup bonus percentage
            //         const bonus =
            //           payment.amount *
            //           (applicableSetting?.membershipBonus?.percentage / 100);

            //         // Ensure the bonus does not exceed the maxium allowed
            //         rewardAmount = Math.min(
            //           bonus,
            //           applicableSetting?.membershipBonus?.maxBonus
            //         )?.toFixed(2);
            //       } else {
            //         // Use top-up bonus percentage
            //         const bonus =
            //           payment.amount *
            //           (applicableSetting?.topUpBonus?.percentage / 100);

            //         // Ensure the bonus does not exceed the maxium allowed
            //         rewardAmount = Math.min(
            //           bonus,
            //           applicableSetting?.topUpBonus?.maxBonus
            //         )?.toFixed(2);
            //       }

            //       if (rewardAmount > 0) {
            //         // payload creation for reward transaction
            //         const rewardTransactionPayload = {
            //           user_id: parentUser._id,
            //           amount: rewardAmount,
            //           transaction_type: TRANSACTION_TYPE.CREDIT,
            //           description: `Referral bonus for ${user.name} - ${
            //             payment.description.toLowerCase().includes("prime")
            //               ? "prime membership"
            //               : "top-up"
            //           } - level : ${
            //             applicableSetting?.level
            //           } - ${rewardAmount}.`,
            //           amount: parseFloat(rewardAmount),
            //           status: TRANSACTION_STATUS.COMPLETED,
            //           wallet_topUp: true,
            //           payment_method: PAYMENT_METHOD.REFERRAL_REWARD,
            //         };

            //         // create the reward transaction
            //         const rewardTransaction = new TransactionModel(
            //           rewardTransactionPayload
            //         );

            //         // save the reward transaction
            //         await rewardTransaction.save({
            //           session,
            //         });

            //         // create the payload for payment history
            //         const referrerPaymentHistoryPayload = {
            //           payment_id: payment.order_id,
            //           reference_id: payment._id,
            //           amount: parseFloat(rewardAmount),
            //           transaction_id: rewardTransaction._id,
            //           starting_balance: parentUser.walletBalance,
            //           transaction_type: TRANSACTION_TYPE.CREDIT,
            //           closing_balance:
            //             parentUser.walletBalance + parseFloat(rewardAmount),
            //           description: `Referral bonus for ${user.name} - ${
            //             payment.description.toLowerCase().includes("prime")
            //               ? "prime membership"
            //               : "top-up"
            //           } - level : ${
            //             applicableSetting?.level
            //           } - ${rewardAmount}.`,
            //         };

            //         parentUser.paymentHistory.unshift(
            //           referrerPaymentHistoryPayload
            //         );

            //         // update the parent user wallet
            //         parentUser.walletBalance += parseFloat(rewardAmount);

            //         // save the parent user
            //         await parentUser.save({
            //           session,
            //         });
            //       }
            //     }
            //   }
            // }

            // await user.save({ session });
          } else if (
            !user.isPrimeMember &&
            amountPaid === PRIME_MEMBERSHIP_AMOUNT * 100
          ) {
            await TransactionModel.findOneAndUpdate(
              { payment_id: payment._id },
              { status: TRANSACTION_STATUS.COMPLETED },
              { session } // Use session for transaction
            );

            const paymentHistoryRecord = {
              payment_id: paymentId,
              reference_id: payment._id,
              amount: transaction.amount,
              transaction_id: transaction._id,
              starting_balance: user.walletBalance,
              transaction_type: TRANSACTION_TYPE.CREDIT,
              closing_balance: user.walletBalance + transaction.amount,
              description: transaction.description,
              timestamp: Date.now(),
            };

            user.paymentHistory.unshift(paymentHistoryRecord);

            user.walletBalance += amountPaid / 100;
            user.isPrimeMember = true;

            await PaymentModel.findOneAndUpdate(
              { order_id: paymentId },
              {
                status: TRANSACTION_STATUS.COMPLETED,
                payment_confirmed_at: new Date(),
              },
              { session } // Use session for transaction
            );

            if (user.referralParents && user.referralParents.length > 0) {
              // fetch the referrer settings
              const referrerSettings = await ReferralSettingsModel.find(
                {},
                {},
                {
                  session,
                }
              );

              if (!referrerSettings) {
                console.log("No Referrer settings not found");
              }

              // for each referral parent run the async function one after another
              for (const parent of user.referralParents) {
                const parentUser = await UserModel.findOne(
                  { _id: parent?.userId },
                  {},
                  {
                    session,
                  }
                );

                if (parentUser && parentUser.isPrimeMember) {
                  // Calculate the reward amount on the payment description
                  let rewardAmount = 0;

                  const applicableSetting = referrerSettings.find(
                    (setting) => setting.level === parent.level
                  );

                  // Check if t he payment description contains "signup"
                  if (payment.description.toLowerCase().includes("prime")) {
                    // Use signup bonus percentage
                    const bonus =
                      payment.amount *
                      (applicableSetting?.membershipBonus?.percentage / 100);

                    // Ensure the bonus does not exceed the maxium allowed
                    rewardAmount = Math.min(
                      bonus,
                      applicableSetting?.membershipBonus?.maxBonus
                    )?.toFixed(2);
                  } else {
                    // Use top-up bonus percentage
                    const bonus =
                      payment.amount *
                      (applicableSetting?.topUpBonus?.percentage / 100);

                    // Ensure the bonus does not exceed the maxium allowed
                    rewardAmount = Math.min(
                      bonus,
                      applicableSetting?.topUpBonus?.maxBonus
                    )?.toFixed(2);
                  }

                  if (rewardAmount > 0) {
                    // payload creation for reward transaction
                    const rewardTransactionPayload = {
                      user_id: parentUser._id,
                      amount: rewardAmount,
                      transaction_type: TRANSACTION_TYPE.CREDIT,
                      description: `Referral bonus for ${user.name} - ${
                        payment.description.toLowerCase().includes("prime")
                          ? "prime membership"
                          : "top-up"
                      } - level : ${
                        applicableSetting?.level
                      } - ${rewardAmount}.`,
                      amount: parseFloat(rewardAmount),
                      status: TRANSACTION_STATUS.COMPLETED,
                      wallet_topUp: true,
                      payment_method: PAYMENT_METHOD.REFERRAL_REWARD,
                    };

                    // create the reward transaction
                    const rewardTransaction = new TransactionModel(
                      rewardTransactionPayload
                    );

                    // save the reward transaction
                    await rewardTransaction.save({
                      session,
                    });

                    // create the payload for payment history
                    const referrerPaymentHistoryPayload = {
                      payment_id: payment.order_id,
                      reference_id: payment._id,
                      amount: parseFloat(rewardAmount),
                      transaction_id: rewardTransaction._id,
                      starting_balance: parentUser.walletBalance,
                      transaction_type: TRANSACTION_TYPE.CREDIT,
                      closing_balance:
                        parentUser.walletBalance + parseFloat(rewardAmount),
                      description: `Referral bonus for ${user.name} - ${
                        payment.description.toLowerCase().includes("prime")
                          ? "prime membership"
                          : "top-up"
                      } - level : ${
                        applicableSetting?.level
                      } - ${rewardAmount}.`,
                    };

                    parentUser.paymentHistory.unshift(
                      referrerPaymentHistoryPayload
                    );

                    // update the parent user wallet
                    parentUser.walletBalance += parseFloat(rewardAmount);

                    // save the parent user
                    await parentUser.save({
                      session,
                    });
                  }
                }
              }
            }

            await user.save({ session });
          } else if (transaction.order_topUp === true) {
            await TransactionModel.findOneAndUpdate(
              { payment_id: payment._id },
              {
                status: TRANSACTION_STATUS.COMPLETED,
                transaction_type: TRANSACTION_TYPE.DEBIT,
              },
              { session } // Use session for transaction
            );

            const paymentHistoryRecord = {
              payment_id: paymentId,
              reference_id: payment._id,
              amount: transaction.amount,
              transaction_id: transaction._id,
              starting_balance: user.walletBalance,
              transaction_type: TRANSACTION_TYPE.DEBIT,
              closing_balance: user.walletBalance,
              description: transaction.description,
              timestamp: Date.now(),
            };

            user.paymentHistory.unshift(paymentHistoryRecord);

            // fast food order - thal order thal - payment
            if (transaction.description?.includes("fastfood")) {
              await FastFoodOrderModel.findOneAndUpdate(
                {
                  paymentIds: transaction._id,
                },
                {
                  status: ORDER_STATUS_MESSAGE.PENDING,
                },
                { session }
              );
            } else {
              await orderModel.findOneAndUpdate(
                {
                  paymentIds: transaction._id,
                },
                {
                  status: ORDER_STATUS_MESSAGE.PENDING,
                },
                { session }
              );
            }

            await PaymentModel.findOneAndUpdate(
              { order_id: paymentId },
              {
                status: TRANSACTION_STATUS.COMPLETED,
                payment_confirmed_at: new Date(),
              },
              { session } // Use session for transaction
            );

            await user.save({ session });
          } else {
            await session.abortTransaction(); // Abort transaction on error
            session.endSession();
            return res.status(400).json({
              message: "Already your purchase prime membership",
            });
          }
        } else {
          await session.abortTransaction(); // Abort transaction on error
          session.endSession();
          return res.status(400).json({
            message: "Payment verification failed",
          });
        }
      } else if (event === ORDER_STATUS.EXPIRED) {
        const paymentId = payload?.payment_link?.entity.id;

        await PaymentModel.findOneAndUpdate(
          { order_id: paymentId },
          {
            status: TRANSACTION_STATUS.FAILED,
            payment_confirmed_at: new Date(),
          },
          { session } // Use session for transaction
        );
        await session.commitTransaction(); // Commit transaction
        session.endSession();
        return res.status(400).json({
          message: "Payment link Expired",
        });
      } else {
        await session.abortTransaction(); // Abort transaction on error
        session.endSession();
        return res.status(400).send("Invalid event");
      }
    }

    await session.commitTransaction(); // Commit transaction
    session.endSession();
    return res.status(200).send("Webhook verified successfully");
  } catch (error) {
    await session.abortTransaction(); // Rollback on error
    session.endSession();
    console.error("Error verifying Razorpay webhook:", error);
    return res.status(500).send("Internal Server Error");
  }
};

const fetchPayments = async (data) => {
  try {
    // const paymentsResponse = await razorpayInstance.payments.all(options);
    const paymentsResponse = await razorpayInstance.paymentLink.fetch(data);
    return paymentsResponse.payments[0]; // This will contain the payment IDs
  } catch (error) {
    console.error("Error fetching payments:", error);
  }
};

const refundRazorpayOrder = async (data) => {
  try {
    const payments = await fetchPayments(data.orderId);

    const options = {
      payment_id: payments.payment_id, // The ID of the payment to be refunded
      amount: payments.amount, // Amount to be refunded (in paise)
    };
    // const razorpayResponse = await razorpayInstance.payments.refund(options);
    const refundResponse = await razorpayInstance.payments.refund(
      options.payment_id,
      {
        amount: options.amount,
      }
    );
    return refundResponse;
  } catch (error) {
    console.error("Refund processing failed", error ? error : error.message);
    return error ? error : error.message;
  }
};

module.exports = {
  createRazorpayOrder,
  razorpayVerifyWebhook,
  refundRazorpayOrder,
  fetchPayments,
};
