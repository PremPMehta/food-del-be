const mongoose = require("mongoose");
const yup = require("yup");

const PaymentModel = require("../../models/payment.model");
const TransactionModel = require("../../models/transaction.model");
const UserModel = require("../../models/users.model");
const ReferralSettingsModel = require("../../models/referral-settings.model");
const {
  USER_STATUS,
  TRANSACTION_TYPE,
  PAYMENT_STATUS,
  TRANSACTION_STATUS,
  PAYMENT_METHOD,
} = require("../../utils/constants");
const {
  PRIME_MEMBERSHIP_AMOUNT,
  FRONTEND_PAYMENT_REDIRECT_URL,
} = require("../../config/config");
const {
  paypalCreateOrder,
  paypalCapturePaymentByAuthorizationId,
} = require("../../services/paypal/paypal");
const { createRazorpayOrder } = require("../../services/razorpay/razorpay");

// api to check user membership status
const checkMembershipStatus = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status === USER_STATUS.INACTIVE) {
      return res.status(400).json({ message: "User is inactive" });
    }

    if (user.status === USER_STATUS.ACTIVE) {
      // we need to return the user membership status and an list of transactions / payments created for prime membership by the user

      const transactionsWithPrime = await TransactionModel.find({
        user_id: req.user._id,
        transaction_type: TRANSACTION_TYPE.CREDIT,
        description: { $regex: /prime/, $options: "i" },
      });

      const userDetails = {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isPrimeMember: user.isPrimeMember,
        walletBalance: user.walletBalance,
        referralCode: user.referralCode,
        role: user.role,
        status: user.status,
      };

      // return response and status
      return res.status(200).json({
        isPrimeMember: user.isPrimeMember,
        transactions: transactionsWithPrime,
        userDetails,
      });
    }
    return res.status(200).json({ message: "User is active" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// api to subscribe to user membership
const subscribeToMembership = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      return res.status(400).json({ message: "User is inactive" });
    }

    if (user.isPrimeMember) {
      return res.status(400).json({ message: "User is already a member" });
    }

    const paymentData = {
      order_description: "Prime membership payment",
      amount: PRIME_MEMBERSHIP_AMOUNT,
      return_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/prime-membership/${req.user._id}/success`,
      cancel_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/prime-membership/${req.user._id}/failure`,
      user_id: req.user._id,
      wallet_topUp: false,
    };

    // const payment = await paypalCreateOrder(paymentData);
    const payment = await createRazorpayOrder(paymentData);

    if (!payment) {
      throw new Error({
        message: "Payment creation failed.",
        code: 500,
      });
    }

    const paymentHistoryRecord = {
      payment_id: payment.createPayment.order_id,
      reference_id: payment.createPayment._id,
      amount: PRIME_MEMBERSHIP_AMOUNT,
      transaction_id: payment.createTransaction._id,
      starting_balance: user.walletBalance,
      transaction_type: TRANSACTION_TYPE.CREDIT,
      closing_balance: user.walletBalance + PRIME_MEMBERSHIP_AMOUNT,
      description: payment.createPayment.description,
      timestamp: Date.now(),
    };

    // Update the user record to add the payment history
    user.paymentHistory.push(paymentHistoryRecord);

    await user.save();

    return res.status(200).json({
      message: "Payment created successfully",
      payment_link: payment.payment_link,
    });
  } catch (error) {
    console.log(error);
    return res.status(error.status ?? 500).json({
      message: error?.code ?? error?.message ?? "Internal server error",
      error,
    });
  }
};

// api to verify payment token for membership
const verifyMembershipPaymentTokenSchema = yup.object().shape({
  token: yup.string().required("Order id / Token is required"),
  payer_id: yup.string().required("Payer id is required"),
});
const verifyMembershipPaymentToken = async (req, res) => {
  const session = await mongoose.startSession();

  await session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    // Validate request body
    const { error } = await verifyMembershipPaymentTokenSchema.validate(
      req.body,
      {
        abortEarly: false,
      }
    );

    if (error) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: error.message });
    }

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

    // call the service to capture payment by authorization id function
    const captureResponse = paypalCapturePaymentByAuthorizationId(
      order_id,
      payer_id
    );

    if (!captureResponse) {
      throw new Error({
        message: "Payment capture failed",
        code: 500,
      });
    }

    // update the payment record with order_id to capture the payment
    payment.payment_confirmed_at = new Date();
    payment.status = PAYMENT_STATUS.COMPLETED;

    await payment.save({ session });

    const transaction = await TransactionModel.findOneAndUpdate(
      {
        payment_id: payment._id,
        transaction_type: TRANSACTION_TYPE.CREDIT,
        description: { $regex: /prime/, $options: "i" },
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
    const user = await UserModel.findOne({ _id: payment.user_id }).session(
      session
    );

    if (!user) {
      throw new Error({
        message: "User not found",
        code: 404,
      });
    }

    user.walletBalance += PRIME_MEMBERSHIP_AMOUNT;
    user.isPrimeMember = true;

    await user.save({ session });

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

          // Use membership bonus percentage
          const bonus =
            payment.amount *
            (applicableSetting.membershipBonus.percentage / 100);

          // Ensure the bonus does not exceed the maximum allowed
          rewardAmount = Math.min(
            bonus,
            applicableSetting.membershipBonus.maxBonus
          )?.toFixed(2);

          if (rewardAmount > 0) {
            // payload creation for reward transaction
            const rewardTransactionPayload = {
              user_id: parentUser._id,
              amount: rewardAmount,
              transaction_type: TRANSACTION_TYPE.CREDIT,
              description: `Prime Membership Referral Reward - ${parentUser.name}`,
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
              description: `Prime Membership Referral Reward - ${parentUser.name}`,
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

    if (!updatedUser) {
      throw new Error({
        message: "User not found",
        code: 404,
      });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Payment captured successfully",
      success: true,
      data: updatedUser,
    });

    // update the user record to add the payment history
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(error.status ?? 500).json({
      message: error?.code ?? error?.message ?? "Internal server error",
      error,
    });
  }
};

module.exports = {
  checkMembershipStatus,
  subscribeToMembership,
  verifyMembershipPaymentToken,
};
