const jwt = require("jsonwebtoken");
const { USER_ROLE } = require("../utils/constants");
const { JWT_SECRET } = require("../config/config");
const AdminUserModel = require("../models/users-admin.model");
const UserModel = require("../models/users.model");

const authenticate = async (req, res, next) => {
  let token;

  const authHeader = req.headers["authorization"];

  // Check if the Authorization header is present and if it starts with "Bearer "
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  // If no token is found , return a 401 error
  if (!token) {
    return res
      .status(401)
      .json({ message: "Unauthorized - No valid token found" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if the token has not expired
    if (decoded.exp < Date.now() / 1000) {
      return res.status(401).json({ message: "Unauthorized - Token expired" });
    }

    // Check if user role is valid
    if (decoded.role !== USER_ROLE.USER) {
      return res
        .status(401)
        .json({ message: "Unauthorized - Invalid user role" });
    }

    /**
     * Set the req.user property to the decoded token
     * and pass it to the next middleware
     */
    const data = await UserModel.findOne({ _id: decoded._id });

    req.user = decoded;
    req.userData = data;

    // Continue to the next middleware
    next();
  } catch (error) {
    // If an error occurs, return a 401 error
    return res
      .status(401)
      .json({ message: "Unauthorized - Invalid or expired token" });
  }
};

// authenticate admin token
const adminAuthenticate = async (req, res, next) => {
  let token;

  const authHeader = req.headers["authorization"];

  // Check if the Authorization header is present and if it starts with "Bearer "
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  // If no token is found , return a 401 error
  if (!token) {
    return res
      .status(401)
      .json({ message: "Unauthorized - No valid token found" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if the token has not expired
    if (decoded.exp < Date.now() / 1000) {
      return res.status(401).json({ message: "Unauthorized - Token expired" });
    }

    // Check if user role is valid
    if (![USER_ROLE.ADMIN, USER_ROLE.SUPERADMIN].includes(decoded.role)) {
      return res
        .status(401)
        .json({ message: "Unauthorized - Invalid user role" });
    }

    /**
     * Set the req.user property to the decoded token
     * and pass it to the next middleware
     */

    const data = await AdminUserModel.findOne({ _id: decoded._id });

    if (!data) {
      return res
        .status(400)
        .json({ message: "Admin user not found Authantication failed" });
    }

    req.admin = data;
    req.user = decoded;

    // Continue to the next middleware
    next();
  } catch (error) {
    // If an error occurs, return a 401 error
    return res
      .status(401)
      .json({ message: "Unauthorized - Invalid or expired token" });
  }
};

const superAdminAuthenticate = async (req, res, next) => {
  let token;

  const authHeader = req.headers["authorization"];

  // Check if the Authorization header is present and if it starts with "Bearer "
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  // If no token is found , return a 401 error
  if (!token) {
    return res
      .status(401)
      .json({ message: "Unauthorized - No valid token found" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if the token has not expired
    if (decoded.exp < Date.now() / 1000) {
      return res.status(401).json({ message: "Unauthorized - Token expired" });
    }

    // Check if user role is valid
    if (USER_ROLE.SUPERADMIN !== decoded.role) {
      return res
        .status(401)
        .json({ message: "Unauthorized - Invalid user role" });
    }

    /**
     * Set the req.user property to the decoded token
     * and pass it to the next middleware
     */

    const data = await AdminUserModel.findOne({ _id: decoded._id });

    if (!data) {
      return res
        .status(400)
        .json({ message: "Admin user not found Authantication failed" });
    }

    req.admin = data;
    req.user = decoded;

    // Continue to the next middleware
    next();
  } catch (error) {
    // If an error occurs, return a 401 error
    return res
      .status(401)
      .json({ message: "Unauthorized - Invalid or expired token" });
  }
};

module.exports = { authenticate, adminAuthenticate, superAdminAuthenticate };
