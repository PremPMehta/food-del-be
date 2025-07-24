const mongoose = require("mongoose");
const yup = require("yup");
const crypto = require("crypto");
const {
  paypalCapturePaymentByAuthorizationId,
  paypalVerifyWebhook,
  paypalCapturePayment,
} = require("../../services/paypal/paypal");

const PaymentModel = require("../../models/payment.model");
const TransactionModel = require("../../models/transaction.model");
const UserModel = require("../../models/users.model");
const ReferralSettingsModel = require("../../models/referral-settings.model");

const {
  PAYMENT_STATUS,
  TRANSACTION_TYPE,
  PAYMENT_METHOD,
  TRANSACTION_STATUS,
  USER_STATUS,
  OPTIONS_PAYPAL_CODES,
} = require("../../utils/constants");
const {
  PAYPAL_WEBHOOK_ID,
  RAZORPAY_ID_KEY,
  RAZORPAY_SECRET_KEY,
} = require("../../config/config");
const { time } = require("console");
const UserPrimeSubscription = require("../../models/prime.model");
const Razorpay = require("razorpay");

const razorpayInstance = new Razorpay({
  key_id: RAZORPAY_ID_KEY,
  key_secret: RAZORPAY_SECRET_KEY,
});

const paymentSchema = yup.object().shape({
  name: yup.string().required("Name is required"),
  email: yup.string().email().required("Email is required"),
  phone: yup
    .string()
    .required("Phone number is required")
    .length(10, "Phone number must be exactly 10 characters long"),
  amount: yup
    .number()
    .required("Amount is required")
    .min(1, "Amount must be greater than 0"),
});

const paypalWebhook = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    // Get the webhook payload from the request body
    const payload = req.body;

    // Get the webhook headers from the request
    const transmissionID = req.headers["paypal-transmission-id"];
    const transmissionTime = req.headers["paypal-transmission-time"];
    const certURL = req.headers["paypal-cert-url"];
    const authAlgo = req.headers["paypal-auth-algo"];
    const transmissionSig = req.headers["paypal-transmission-sig"];

    // Verify the webhook event using the PayPal service
    const verificationPayload = {
      webhook_id: PAYPAL_WEBHOOK_ID,
      transmission_id: transmissionID,
      transmission_time: transmissionTime,
      cert_url: certURL,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_event: payload,
    };

    const verifyResponse = await paypalVerifyWebhook(verificationPayload);

    if (verifyResponse.verification_status !== OPTIONS_PAYPAL_CODES.VERIFIED) {
      console.log("Webhook verification failed");
      throw new Error("Webhook verification failed");
    }

    // If the webhook event is verified , process it
    if (payload.event_type === OPTIONS_PAYPAL_CODES["CHECKOUT-APPROVED"]) {
      // Capture the payment using the PayPal service
      const captureLink = payload["resource"]["links"].find(
        (record) => record.rel === "capture"
      )?.href;

      const orderID = payload["resource"]["id"];

      const captureResponse = await paypalCapturePayment(captureLink);

      if (!captureResponse) {
        throw new Error("Payment capture failed");
      }

      return res.status(200).json({ success: true });
    } else if (
      payload.event_type === OPTIONS_PAYPAL_CODES["CAPTURE-COMPLETED"]
    ) {
      // Update the payment record with order_id to capture the payment

      const payment = await PaymentModel.findOne(
        {
          order_id:
            payload["resource"]["supplementary_data"]["related_ids"][
              "order_id"
            ],
          payment_confirmed_at: null,
        },
        {},
        {
          session,
        }
      );

      if (!payment) {
        throw new Error("Payment not found");
      }

      if (payment.status !== PAYMENT_STATUS.PENDING) {
        session.abortTransaction();
        session.endSession();

        return res
          .status(200)
          .json({ success: true, message: "Payment already captured" });
      }
      // {
      //   status: PAYMENT_STATUS.COMPLETED,
      //   payment_confirmed_at: new Date(),
      // }

      payment.status = PAYMENT_STATUS.COMPLETED;
      payment.payment_confirmed_at = new Date();

      await payment.save({ session });

      const transaction = await TransactionModel.findOneAndUpdate(
        {
          payment_id: payment._id,
          transaction_type: TRANSACTION_TYPE.CREDIT,
          status: TRANSACTION_STATUS.PENDING,
        },
        {
          status: TRANSACTION_STATUS.COMPLETED,
        },
        {
          session,
        }
      );

      if (!transaction) {
        throw new Error("Transaction not found");
      }

      // update the user wallet
      const user = await UserModel.findOne(
        // user status active or pending
        {
          _id: payment.user_id,
          status: { $in: [USER_STATUS.PENDING, USER_STATUS.ACTIVE] },
        },
        {},
        {
          session,
        }
      );

      if (!user) {
        throw new Error("User not found");
      }

      user.walletBalance = user.walletBalance + transaction.amount;
      if (user.status === USER_STATUS.PENDING) {
        user.status = USER_STATUS.ACTIVE;
        user.isPrimeMember = true;
      }

      // check for paypal referrer
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
                } - level : ${applicableSetting?.level} - ${rewardAmount}.`,
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
                } - level : ${applicableSetting?.level} - ${rewardAmount}.`,
              };

              parentUser.paymentHistory.unshift(referrerPaymentHistoryPayload);

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

      session.commitTransaction();
      console.log("Payment captured successfully");
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    await session.abortTransaction();
    console.log("error :> ", error);
    console.log("Payment webhook failed");
    return res
      .status(error.status ?? 500)
      .json({ message: error?.code ?? error.message, error });
  }
};

const verifyPaymentSchema = yup.object().shape({
  token: yup.string().required("Order id / Token is required"),
  payer_id: yup.string().required("Payer id is required"),
});

const verifyPaymentToken = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    // Validate request body
    await verifyPaymentSchema.validate(req.body);

    const { token: order_id, payer_id } = req.body;

    const payment = await PaymentModel.findOne(
      { order_id, status: PAYMENT_STATUS.PENDING, payment_confirmed_at: null },
      {},
      {
        session,
      }
    );

    // if payment is not found
    if (!payment) {
      throw new Error("Payment not found");
    }

    // call the service to capture payment by authorization id funciton
    const captureResponse = paypalCapturePaymentByAuthorizationId(
      order_id,
      payer_id
    );

    if (!captureResponse) {
      throw new Error("Payment capture failed");
    }

    payment.status = PAYMENT_STATUS.COMPLETED;
    payment.payment_confirmed_at = new Date();
    await payment.save({ session });

    const transaction = await TransactionModel.findOneAndUpdate(
      {
        payment_id: payment._id,
        transaction_type: TRANSACTION_TYPE.CREDIT,
        payment_method: PAYMENT_METHOD.PAYPAL,
        status: TRANSACTION_STATUS.PENDING,
      },
      {
        status: TRANSACTION_STATUS.COMPLETED,
      },
      {
        session,
      }
    );

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // update the user wallet
    const user = await UserModel.findOne(
      // user status active or pending
      {
        _id: payment.user_id,
        status: { $in: [USER_STATUS.PENDING, USER_STATUS.ACTIVE] },
      },
      {},
      {
        session,
      }
    );

    if (!user) {
      throw new Error("User not found");
    }

    user.walletBalance = user.walletBalance + transaction.amount;
    if (user.status === USER_STATUS.PENDING) {
      user.status = USER_STATUS.ACTIVE;
      user.isPrimeMember = true;
    }

    // check for paypal referrer
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
              } - level : ${applicableSetting?.level} - ${rewardAmount}.`,
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
              } - level : ${applicableSetting?.level} - ${rewardAmount}.`,
            };

            parentUser.paymentHistory.unshift(referrerPaymentHistoryPayload);

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

    session.commitTransaction();
    console.log("Payment captured successfully");

    return res.status(200).json({
      message: "Payment captured successfully",
      success: true,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(error.status ?? 500).json({
      message: error?.code ?? error?.message ?? "Internal server error",
      error,
    });
  }
};

const verifySignupPaymentSchema = yup.object().shape({
  token: yup.string().required("Order id / Token is required"),
  payer_id: yup.string().required("Payer id is required"),
});
const verifySignupPaymentToken = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    // Validate request body
    await verifySignupPaymentSchema.validate(req.body);

    const { token: order_id, payer_id } = req.body;

    const payment = await PaymentModel.findOne(
      { order_id, status: PAYMENT_STATUS.PENDING, payment_confirmed_at: null },
      {},
      {
        session,
      }
    );

    // if payment is not found
    if (!payment) {
      throw new Error({
        message: "Payment not found",
        code: 404,
      });
    }

    // call the service to capture payment by authorization id funciton
    const captureResponse = paypalCapturePaymentByAuthorizationId(
      order_id,
      payer_id
    );

    if (!captureResponse) {
      throw new Error("Payment capture failed");
    }

    // update the payment record with order_id to capture the payment
    payment.payment_confirmed_at = new Date();
    payment.status = PAYMENT_STATUS.COMPLETED;

    await payment.save({ session });

    const transaction = await TransactionModel.findOneAndUpdate(
      {
        payment_id: payment._id,
        transaction_type: TRANSACTION_TYPE.CREDIT,
        payment_method: PAYMENT_METHOD.PAYPAL,
        status: TRANSACTION_STATUS.PENDING,
      },
      {
        status: TRANSACTION_STATUS.COMPLETED,
      },
      {
        session,
      }
    );

    // if transaction is not found
    if (!transaction) {
      throw new Error({
        message: "Transaction not found",
        code: 404,
      });
    }

    // update the user balance and status
    const user = await UserModel.findOne(
      { _id: payment.user_id },
      {
        _id: 1,
        name: 1,
        email: 1,
        phone: 1,
        walletBalance: 1,
        status: 1,
        referralParents: 1,
        isPrimeMember: 1,
        role: 1,
      },
      {
        session,
      }
    );

    if (!user) {
      throw new Error("User not found");
    }

    user.walletBalance = user.walletBalance + payment.amount;

    await user.save({ session });

    // check for paypal referrer
    if (user.referralParents && user.referralParents.length > 0) {
      // fetch the referral settings
      const referralSettings = await ReferralSettingsModel.find(
        {},
        {},
        {
          session,
        }
      );

      if (!referralSettings) {
        console.log("No Referrer Settings found");
      }

      // for each referral parent run the async function one after another
      for (const parent of user.referralParents) {
        const parentUser = await UserModel.findOne(
          {
            _id: parent?.userId,
          },
          {},
          {
            session,
          }
        );

        if (!parentUser || !parentUser.isPrimeMember) {
          continue; // Skip to the next parent if they are not a prime member
        }

        // Calculate the reward amount on the payment description
        let rewardAmount = 0;

        const applicableSetting = referralSettings.find(
          (setting) => setting.level === parent.level
        );

        // Use signup bonus percentage
        const bonus =
          payment.amount *
          (applicableSetting?.membershipBonus?.percentage / 100);

        // Ensure the bonus does not exceed the maxium allowed
        rewardAmount = Math.min(
          bonus,
          applicableSetting?.membershipBonus?.maxBonus
        )?.toFixed(2);

        if (rewardAmount > 0) {
          // payload creation for reward transaction
          const rewardTransactionPayload = {
            user_id: parentUser._id,
            transaction_type: TRANSACTION_TYPE.CREDIT,
            description: `Referral bonus for ${user.name} - signup - level : ${applicableSetting?.level} - ${rewardAmount}.`,
            payment_method: PAYMENT_METHOD.REFERRAL_REWARD,
            amount: parseFloat(rewardAmount),
            status: TRANSACTION_STATUS.COMPLETED,
            wallet_topUp: true,
          };

          // create the reward transaction
          const rewardTransaction = new TransactionModel(
            rewardTransactionPayload
          );

          // save the reward transaction
          await rewardTransaction.save({ session });

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
            description: `Referral bonus for ${user.name} - signup - level : ${applicableSetting?.level} - ${rewardAmount}.`,
          };

          parentUser.paymentHistory.unshift(referrerPaymentHistoryPayload);

          // update the parent user wallet
          parentUser.walletBalance =
            parentUser.walletBalance + parseFloat(rewardAmount);

          // save the parent user
          await parentUser.save({ session });
        }
      }
    }

    const updatedUser = await UserModel.findOne(
      { _id: payment.user_id },
      {
        _id: 1,
        name: 1,
        email: 1,
        phone: 1,
        walletBalance: 1,
        status: 1,
        isPrimeMember: 1,
        role: 1,
      },
      {
        session,
      }
    );

    // commit the transaction

    await session.commitTransaction();
    session.endSession();
    return res.status(200).json({ updatedUser });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(error.status ?? 500).json({
      message: error?.code ?? error?.message ?? "Internal server error",
      error,
    });
  }
};

// const userWalletTopUp = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction(); // Start the transaction immediately after creating the session

//   try {
//     const { user_id, amount } = req.body;
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     return res.status(error.status ?? 500).json({
//       message: error?.code ?? error?.message ??  "Internal server error",
//       error,
//     });
//   }
// };

const razorpayCreatePayment = async (req, res) => {
  try {
    console.log("req.user", req.user);
    const { userId, planId } = req.body;

    // Fetch the selected plan
    // const plan = await PrimePlan.findById(planId);
    // if (!plan) {
    //   return res
    //     .status(404)
    //     .json({ success: false, message: "Prime plan not found" });
    // }

    // Create Razorpay payment link
    const paymentLink = await razorpayInstance.paymentLink.create({
      amount: 100, // Amount in smallest currency unit (e.g., paisa for INR)
      currency: "INR",
      description: `Prime Membership (${10} days)`,
      callback_url: "http://localhost:8000/prime/callback",
      callback_method: "get",
    });

    // Save the subscription with pending status
    // const subscription = new UserPrimeSubscription({
    //   userId,
    //   endDate: new Date(Date.now() + plan.duration * 24 * 60 * 60 * 1000),
    //   paymentStatus: "pending",
    //   razorpayPaymentId: paymentLink.id,
    // });

    // await subscription.save();

    res.status(200).json({
      success: true,
      paymentLink: paymentLink.short_url,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating payment link",
      error: error.message,
    });
  }
};

const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_signature } = req.query;

    // Verify Razorpay signature
    const isValid = razorpayInstance.utils.verifyPaymentSignature({
      order_id: razorpay_payment_id,
      razorpay_signature: razorpay_signature,
    });

    if (!isValid) {
      return res
        .status(400)
        .json({ success: false, message: "Payment verification failed" });
    }

    // Update subscription status to success
    const subscription = await UserPrimeSubscription.findOneAndUpdate(
      { razorpayPaymentId: razorpay_payment_id },
      { paymentStatus: "success" },
      { new: true }
    );

    if (!subscription) {
      return res
        .status(404)
        .json({ success: false, message: "Subscription not found" });
    }

    res.status(200).json({
      success: true,
      message: "Prime membership activated",
      subscription,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error handling payment callback",
      error: error.message,
    });
  }
};

module.exports = {
  razorpayCreatePayment,
  verifyRazorpayPayment,
  paypalWebhook,
  verifyPaymentToken,
  verifySignupPaymentToken,
};
