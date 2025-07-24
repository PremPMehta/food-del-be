const jwt = require("jsonwebtoken");
const { encrypt, verifyPassword, signJwtToken } = require("../../utils/common");
const UserModel = require("../../models/users.model");
const yup = require("yup");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const {
  SALT_ROUNDS,
  FRONTEND_URL,
  PRIME_MEMBERSHIP_AMOUNT,
} = require("../../config/config");
const PasswordResetToken = require("../../models/resetToken.model");
const { paypalCreateOrder } = require("../../services/paypal/paypal");
const { TRANSACTION_TYPE, USER_STATUS } = require("../../utils/constants");

// Define Yup validation schema
const userSchema = yup.object().shape({
  name: yup.string().required("Name is required"),
  email: yup.string().email().required("Email is required"),
  phone: yup
    .string()
    .required("Phone number is required")
    .length(10, "Phone number must be exactly 10 characters long"),
  password: yup
    .string()
    .min(6, "Password must be at least 6 characters long")
    .required("Password is required"),
  referralCode: yup
    .string()
    .optional() // Make referralCode optional
    .matches(
      /^[A-Z0-9]{6}$/,
      "Referral code must be exactly 6 characters long and consist of uppercase letters and numbers"
    ), // Optional regex validation
});

/**
 * Registers a new user
 *
 * @param {Object} req The request object
 * @param {Object} res The response object
 *
 * @returns {Promise<Object>} The created user
 */

// previous code

// const registerUser = async (req, res) => {
//   const session = await mongoose.startSession();
//   console.log("session", session);
//   session.startTransaction(); // Start the transaction immediately after creating the session

//   try {
//     // Validate request body
//     await userSchema.validate(req.body);

//     // Create user
//     const { name, email, phone, password, referralCode } = req.body;
//     console.log(req.body);

//     // Ensure phone number is not null or undefined
//     if (!phone) {
//       throw new Error("Phone number is required");
//     }

//     // Check if user already exists
//     const existingUser = await UserModel.findOne({
//       $or: [{ email }, { phone }],
//     }).session(session);

//     if (existingUser) {
//       throw new Error("User  already exists");
//     }

//     // Hash the password
//     const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

//     // Prepare to create the user
//     const user = new UserModel({
//       name,
//       email,
//       phone,
//       password: hashedPassword, // Save the hashed password
//     });
//     console.log("------------------>", user);
//     // Check for referral code and set direct referrer
//     if (referralCode) {
//       const referrer = await UserModel.findOne({ referralCode }).session(
//         session
//       );

//       // Check if the referrer exists and is active
//       if (referrer) {
//         if (referrer.status !== USER_STATUS.ACTIVE) {
//           return res.status(404).json({
//             error: "Referral code is invalid or the referrer is not active.",
//           });
//         }

//         user.directReferrer = referrer._id; // Set the direct referrer

//         // Prepare the referralParents array
//         user.referralParents.push({ userId: referrer._id, level: 1 });

//         // If there's a direct referrer, check for their referralParents
//         if (referrer.referralParents) {
//           for (const referral of referrer.referralParents) {
//             if (referral.level < 3) {
//               user.referralParents.push({
//                 userId: referral.userId,
//                 level: referral.level + 1,
//               });
//             }
//           }
//         }
//       } else {
//         // If no referrer found, return 404
//         return res.status(404).json({ error: "Referral code is invalid." });
//       }
//     }

//     let data = await user.save({ session }); // Save the user with the session
//     console.log("Saved data ", data);
//     // // Create a payment transaction to return payment url
//     // const paymentData = {
//     //   order_description: `Signup wallet top-up payment ${PRIME_MEMBERSHIP_AMOUNT}.`,
//     //   amount: PRIME_MEMBERSHIP_AMOUNT,
//     //   return_url: `${FRONTEND_URL}/signup-payment?type=success`,
//     //   cancel_url: `${FRONTEND_URL}/signup-payment?type=failure`,
//     //   user_id: user._id,
//     //   wallet_topUp: true,
//     // };

//     // const payment = await paypalCreateOrder(paymentData);

//     // if (!payment) {
//     //   throw new Error("Payment failed");
//     // }

//     // const paymentHistoryRecord = {
//     //   payment_id: payment.createPayment.order_id,
//     //   reference_id: payment.createPayment._id,
//     //   amount: PRIME_MEMBERSHIP_AMOUNT,
//     //   transaction_id: payment.createTransaction._id,
//     //   starting_balance: 0,
//     //   transaction_type: TRANSACTION_TYPE.CREDIT,
//     //   closing_balance: PRIME_MEMBERSHIP_AMOUNT,
//     //   description: payment.createPayment.description,
//     //   timestamp: Date.now(),
//     // };

//     // // Update the user record to add the payment history
//     // user.paymentHistory.push(paymentHistoryRecord);

//     // await user.save({ session }); // Save the updated user with the session

//     const token = signJwtToken(
//       {
//         _id: user._id,
//         name: user.name,
//         email: user.email,
//         phone: user.phone,
//         role: user.role,
//       },
//       "1d"
//     );

//     const responsePayload = {
//       user: {
//         _id: user._id,
//         name: user.name,
//         email: user.email,
//         phone: user.phone,
//         isPrimeMember: user.isPrimeMember,
//         walletBalance: user.walletBalance,
//         referralCode: user.referralCode,
//         role: user.role,
//         status: user.status,
//         expires_at: new Date(jwt.decode(token).exp * 1000), // convert seconds to milliseconds
//         // deleted: user.deleted,
//       },
//       token: token,
//       // payment_link: payment.payment_link,
//     };

//     // Commit the transaction
//     await session.commitTransaction();
//     session.endSession(); // End the session in the catch block to ensure it's always executed
//     return res.status(201).json(responsePayload); // Respond with the created user
//   } catch (error) {
//     // Handle errors
//     await session.abortTransaction(); // Ensure to abort the transaction if an error occurs
//     session.endSession(); // End the session in the catch block to ensure it's always executed
//     return res.status(400).json({ error: error.message });
//   } finally {
//     session.endSession(); // End the session in the finally block to ensure it's always executed
//   }
// };

const registerUser = async (req, res) => {
  try {
    // Validate request body
    await userSchema.validate(req.body);

    // Create user
    const { name, email, phone, password, referralCode } = req.body;
    console.log(req.body);
    // Ensure phone number is not null or undefined
    if (!phone) {
      throw new Error("Phone number is required");
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      throw new Error("User  already exists");
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Prepare to create the user
    const user = new UserModel({
      name,
      email,
      phone,
      password: hashedPassword, // Save the hashed password
    });
    console.log("------------------>", user);
    // Check for referral code and set direct referrer
    if (referralCode) {
      const referrer = await UserModel.findOne({ referralCode });

      // Check if the referrer exists and is active
      if (referrer) {
        if (referrer.status !== USER_STATUS.ACTIVE) {
          return res.status(404).json({
            error: "Referral code is invalid or the referrer is not active.",
          });
        }

        user.directReferrer = referrer._id; // Set the direct referrer

        // Prepare the referralParents array
        user.referralParents.push({ userId: referrer._id, level: 1 });

        // If there's a direct referrer, check for their referralParents
        if (referrer.referralParents) {
          for (const referral of referrer.referralParents) {
            if (referral.level < 3) {
              user.referralParents.push({
                userId: referral.userId,
                level: referral.level + 1,
              });
            }
          }
        }
      } else {
        // If no referrer found, return 404
        return res.status(404).json({ error: "Referral code is invalid." });
      }
    }

    let data = await user.save(); // Save the user with the session
    console.log("Saved data ", data);

    const token = signJwtToken(
      {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      "1d"
    );

    const responsePayload = {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isPrimeMember: user.isPrimeMember,
        walletBalance: user.walletBalance,
        referralCode: user.referralCode,
        addresses: [],
        role: user.role,
        status: user.status,
        expires_at: new Date(jwt.decode(token).exp * 1000), // convert seconds to milliseconds
        // deleted: user.deleted,
      },
      token: token,
      // payment_link: payment.payment_link,
    };

    return res.status(201).json(responsePayload); // Respond with the created user
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};
const loginSchema = yup.object().shape({
  email: yup.string().email().required("Email is required"),
  password: yup
    .string()
    .min(6, "Password must be at least 6 characters long")
    .required("Password is required"),
  remember: yup.boolean().optional(),
});
// previous code

// const loginUser = async (req, res) => {
//   const session = await mongoose.startSession();
//   await session.startTransaction(); // Start the transaction immediately after creating the session

//   try {
//     // Validate request body
//     await loginSchema.validate(req.body);

//     const { email, password, remember = false } = req.body;

//     // Find user by email
//     // status should be pending , or active
//     const user = await UserModel.findOne({
//       email,
//       status: { $in: [USER_STATUS.PENDING, USER_STATUS.ACTIVE] },
//     }).session(session);
//     if (!user) {
//       throw new Error("User not found");
//     }

//     // Verify password
//     const isValid = await verifyPassword(user.password, password);
//     if (!isValid) {
//       throw new Error("Invalid password");
//     }

//     // Generate JWT token
//     const token = signJwtToken(
//       {
//         _id: user._id,
//         name: user.name,
//         email: user.email,
//         phone: user.phone,
//         role: user.role,
//       },
//       remember ? "1d" : "1h"
//     );

//     const data = {
//       _id: user._id,
//       name: user.name,
//       email: user.email,
//       phone: user.phone,
//       isPrimeMember: user.isPrimeMember,
//       walletBalance: user.walletBalance,
//       referralCode: user.referralCode,
//       role: user.role,
//       status: user.status,
//       expires_at: new Date(jwt.decode(token).exp * 1000), // convert seconds to milliseconds
//     };

//     // Commit the transaction
//     await session.commitTransaction();
//     session.endSession(); // End the session in the catch block to ensure it's always executed
//     return res.status(200).json({ user: data, token });
//   } catch (error) {
//     // Handle errors
//     await session.abortTransaction(); // Ensure to abort the transaction if an error occurs
//     session.endSession(); // End the session in the catch block to ensure it's always executed
//     return res.status(400).json({ error: error.message });
//   } finally {
//     session.endSession(); // End the session in the finally block to ensure it's always executed
//   }
// };

const loginUser = async (req, res) => {
  try {
    // Validate request body
    await loginSchema.validate(req.body);

    const { email, password, remember = false } = req.body;

    const user = await UserModel.findOne({
      email,
      status: { $in: [USER_STATUS.PENDING, USER_STATUS.ACTIVE] },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Verify password
    const isValid = await verifyPassword(user.password, password);
    if (!isValid) {
      throw new Error("Invalid password");
    }

    // Generate JWT token
    const token = signJwtToken(
      {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      remember ? "1d" : "1h"
    );

    const data = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isPrimeMember: user.isPrimeMember,
      walletBalance: user.walletBalance,
      referralCode: user.referralCode,
      addresses: user.addresses,
      role: user.role,
      status: user.status,
      expires_at: new Date(jwt.decode(token).exp * 1000), // convert seconds to milliseconds
    };

    return res.status(200).json({ user: data, token });
  } catch (error) {
    // Handle errors
    return res.status(400).json({ error: error.message });
  }
};

const forgetPasswordSchema = yup.object().shape({
  email: yup.string().email().required("Email is required"),
});

const forgetPassword = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    await forgetPasswordSchema.validate(req.body);

    const { email } = req.body;
    const user = await UserModel.findOne({ email }).session(session);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = Math.random().toString(36).substr(2, 10); // Generate a random token

    const passwordResetToken = new PasswordResetToken({
      userId: user.id,
      token,
    });

    await passwordResetToken.save({ session });

    // const msg = {
    //   to: email,
    //   subject: "Password Reset Token",
    //   html: `
    //       <h1>Password Reset Token</h1>
    //       <p>To reset your password, click on the following link:</p>
    //       <a href="${FRONTEND_URL}/reset-password?token=${token}">Reset Password</a>
    //     `,
    // };

    // await sgMail.send(msg);

    // Commit the transaction
    await session.commitTransaction();
    session.endSession(); // End the session in the catch block to ensure it's always executed

    res.json({ message: "Password reset token sent to your email", token });
  } catch (error) {
    console.error(error);

    // Handle errors
    await session.abortTransaction(); // Ensure to abort the transaction if an error occurs
    session.endSession(); // End the session in the catch block to ensure it's always executed

    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    session.endSession(); // End the session in the finally block to ensure it's always executed
  }
};

const resetPasswordSchema = yup.object().shape({
  token: yup.string().required("Token is required"),
  password: yup
    .string()
    .min(6, "Password must be at least 6 characters long")
    .required("Password is required"),
});

const resetPassword = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); // Start the transaction immediately after creating the session

  try {
    await resetPasswordSchema.validate(req.body);

    const { token, password } = req.body;

    const passwordResetToken = await PasswordResetToken.findOne({
      token,
    }).session(session);

    if (!passwordResetToken) {
      throw new Error("Invalid token");
    }

    // check if token has not expired
    if (passwordResetToken.expiresAt < Date.now()) {
      throw new Error("Token has expired");
    }

    const user = await UserModel.findById(passwordResetToken.userId).session(
      session
    );

    if (!user) {
      throw new Error("User not found");
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Update the user's password
    user.password = hashedPassword;

    await user.save({ session });

    // Delete the password reset token
    await PasswordResetToken.findByIdAndDelete(passwordResetToken._id, {
      session,
    });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession(); // End the session in the catch block to ensure it's always executed
    return res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    // Handle errors
    await session.abortTransaction(); // Ensure to abort the transaction if an error occurs
    session.endSession(); // End the session in the catch block to ensure it's always executed
    return res.status(400).json({ error: error.message });
  } finally {
    session.endSession(); // End the session in the finally block to ensure it's always executed
  }
};

module.exports = { registerUser, loginUser, forgetPassword, resetPassword };
