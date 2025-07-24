const jwt = require("jsonwebtoken");
const User = require("../../models/users.model");
const bcrypt = require("bcrypt");
const { JWT_SECRET, FRONTEND_URL } = require("../../config/config");
const sendMail = require("../../utils/mailer");

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log(email);
    let existingEmail = await User.findOne({ email: email });
    if (!existingEmail) {
      return res.status(400).json({ message: "email not found" });
    }
    const token = jwt.sign({ _id: existingEmail._id }, JWT_SECRET, {
      expiresIn: "5m",
    });

    sendMail({
      email: existingEmail.email,
      subject: "User Verification for forgot password",
      message: `Click here ${FRONTEND_URL}/forgotPage/${token}`,
    });

    return res.status(200).json({ message: "link sent to email" });
  } catch (error) {
    return res.status(500).json({
      message: "internal server error",
      error: error ? error : error.message,
    });
  }
};

const forgetChangePassword = async (req, res) => {
  try {
    const token = req.params.token;
    const { Password, cnfPassword } = req.body;
    if (!token) {
      return res.status(400).json({ message: "token is required" });
    }
    const decodedata = jwt.verify(token, JWT_SECRET);

    const user = await User.findOne({ _id: decodedata._id });

    if (!user) {
      return res.status(400).json({ message: "user is required" });
    }
    if (Password != cnfPassword) {
      return res
        .status(400)
        .json({ message: "password and confirm password is incorrect" });
    }
    const hashedPassword = await bcrypt.hash(Password, 10);

    await User.findByIdAndUpdate(user._id, {
      $set: { password: hashedPassword },
    });

    res.status(200).json({ message: "Password forget successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "internal server error",
      error: error ? error : error.message,
    });
  }
};

module.exports = { forgotPassword, forgetChangePassword };
