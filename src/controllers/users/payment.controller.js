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
  FRONTEND_PAYMENT_REDIRECT_URL,
} = require("../../config/config");
const { time } = require("console");
const UserPrimeSubscription = require("../../models/prime.model");

// Import enhanced Razorpay service
const {
  createRazorpayOrder,
  createRazorpayPaymentLink,
  verifyPaymentSignature,
  capturePayment,
  getPaymentDetails,
  getOrderDetails,
  getTestCardDetails,
  razorpayInstance,
} = require("../../services/razorpay/razorpay");

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

/**
 * Create Razorpay payment for wallet top-up
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createWalletTopUpPayment = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    const paymentData = {
      amount: amount,
      currency: "INR",
      description: `Wallet top-up of ₹${amount}`,
      user_id: userId,
      callback_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/payment/success`,
      callback_method: "get",
      wallet_topUp: true,
      customer: {
        name: req.user.name,
        email: req.user.email,
        contact: req.user.phone,
      },
      notify: {
        sms: true,
        email: true,
      },
    };

    const result = await createRazorpayPaymentLink(paymentData);

    res.status(200).json({
      success: true,
      message: "Payment link created successfully",
      data: {
        payment_link: result.payment_link,
        payment_id: result.payment_id,
        amount: amount,
      },
    });
  } catch (error) {
    console.error("Error creating wallet top-up payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment link",
      error: error.message,
    });
  }
};

/**
 * Create Razorpay payment for prime membership
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createPrimeMembershipPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await UserModel.findById(userId);

    if (user.isPrimeMember) {
      return res.status(400).json({
        success: false,
        message: "User is already a prime member",
      });
    }

    const paymentData = {
      amount: 999, // Prime membership amount
      currency: "INR",
      description: "Prime Membership (30 days)",
      user_id: userId,
      callback_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/payment/success`,
      callback_method: "get",
      customer: {
        name: user.name,
        email: user.email,
        contact: user.phone,
      },
      notify: {
        sms: true,
        email: true,
      },
    };

    const result = await createRazorpayPaymentLink(paymentData);

    res.status(200).json({
      success: true,
      message: "Prime membership payment link created successfully",
      data: {
        payment_link: result.payment_link,
        payment_id: result.payment_id,
        amount: paymentData.amount,
      },
    });
  } catch (error) {
    console.error("Error creating prime membership payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment link",
      error: error.message,
    });
  }
};

/**
 * Create Razorpay payment for order
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createOrderPayment = async (req, res) => {
  try {
    const { amount, orderId, orderType = "thal" } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const paymentData = {
      amount: amount,
      currency: "INR",
      description: `Payment for ${orderType} order - ${orderId}`,
      user_id: userId,
      callback_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/payment/success`,
      callback_method: "get",
      order_topUp: true,
      customer: {
        name: req.user.name,
        email: req.user.email,
        contact: req.user.phone,
      },
      notify: {
        sms: true,
        email: true,
      },
      notes: {
        order_id: orderId,
        order_type: orderType,
      },
    };

    const result = await createRazorpayPaymentLink(paymentData);

    res.status(200).json({
      success: true,
      message: "Order payment link created successfully",
      data: {
        payment_link: result.payment_link,
        payment_id: result.payment_id,
        amount: amount,
        order_id: orderId,
      },
    });
  } catch (error) {
    console.error("Error creating order payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment link",
      error: error.message,
    });
  }
};

/**
 * Verify Razorpay payment manually
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification parameters",
      });
    }

    // Verify payment signature
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    // Get payment details
    const paymentDetails = await getPaymentDetails(razorpay_payment_id);

    if (!paymentDetails.success) {
      return res.status(400).json({
        success: false,
        message: "Failed to fetch payment details",
      });
    }

    const payment = paymentDetails.payment;

    // Check if payment is already captured
    if (payment.status === "captured") {
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        data: {
          payment_id: payment.id,
          status: payment.status,
          amount: payment.amount / 100,
        },
      });
    }

    // Capture the payment
    const captureResult = await capturePayment(
      razorpay_payment_id,
      payment.amount,
      payment.currency
    );

    res.status(200).json({
      success: true,
      message: "Payment verified and captured successfully",
      data: {
        payment_id: payment.id,
        capture_id: captureResult.capture_id,
        status: captureResult.status,
        amount: payment.amount / 100,
      },
    });
  } catch (error) {
    console.error("Error verifying Razorpay payment:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message,
    });
  }
};

/**
 * Get payment status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPaymentStatus = async (req, res) => {
  try {
    const { payment_id } = req.params;
    const userId = req.user.id;

    const payment = await PaymentModel.findOne({
      order_id: payment_id,
      user_id: userId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        payment_id: payment.order_id,
        status: payment.status,
        amount: payment.amount,
        description: payment.description,
        created_at: payment.createdAt,
        confirmed_at: payment.payment_confirmed_at,
      },
    });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment status",
      error: error.message,
    });
  }
};

/**
 * Get test card details for sandbox testing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTestCards = async (req, res) => {
  try {
    const testCards = getTestCardDetails();

    res.status(200).json({
      success: true,
      message: "Test card details retrieved successfully",
      data: testCards,
    });
  } catch (error) {
    console.error("Error fetching test cards:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch test card details",
      error: error.message,
    });
  }
};

/**
 * Refund payment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const refundPayment = async (req, res) => {
  try {
    const { payment_id, reason } = req.body;
    const userId = req.user.id;

    if (!payment_id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    // Verify payment belongs to user
    const payment = await PaymentModel.findOne({
      order_id: payment_id,
      user_id: userId,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Payment is not completed",
      });
    }

    const refundData = {
      orderId: payment_id,
      reason: reason || "Customer requested refund",
    };

    // Assuming refundRazorpayOrder is a function from razorpayInstance or a similar service
    // For now, we'll just return a placeholder response
    res.status(200).json({
      success: true,
      message: "Refund initiated successfully (Razorpay not fully integrated)",
      data: {
        refund_id: "placeholder_refund_id",
        status: "pending",
        amount: payment.amount / 100,
      },
    });
  } catch (error) {
    console.error("Error processing refund:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process refund",
      error: error.message,
    });
  }
};

module.exports = {
  createWalletTopUpPayment,
  createPrimeMembershipPayment,
  createOrderPayment,
  verifyRazorpayPayment,
  getPaymentStatus,
  getTestCards,
  refundPayment,
  razorpayCreatePayment,
  paypalWebhook,
  verifyPaymentToken,
  verifySignupPaymentToken,
};
