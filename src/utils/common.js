// utils/common.js
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const { SALT_ROUNDS, JWT_SECRET } = require("../config/config");
const jwt = require("jsonwebtoken");

// Loads environment variables from a .env file into process.env
// This is necessary as some of the environment variables are used
// in the application code and some are used in the database configuration
// file
dotenv.config();

const saltRounds = Number(SALT_ROUNDS) || 10;

/**
 * Encrypts the given data using bcrypt
 *
 * @param {string} data The data to be encrypted. This could be a string,
 *                      a password, or any other sensitive information that
 *                      needs to be encrypted.
 *
 * @returns {Promise<string>} The encrypted data. This is a string that
 *                            represents the encrypted data. This string is
 *                            safe to store in a database or to send over
 *                            a network.
 */
async function encrypt(data) {
  try {
    // Hash the data using bcrypt
    // The saltRounds variable is used to specify the cost of the hash
    // A higher cost means that the hash will take longer to compute
    // but it will also be more secure
    const hashedData = await bcrypt.hash(data, saltRounds);

    // Return the hashed data
    return hashedData;
  } catch (err) {
    // If there is an error, log it to the console
    console.error(err);
    // And rethrow the error so that it can be handled by the caller
    throw err;
  }
}

/**
 * Verifies a password against a hashed password
 *
 * This function takes a hashed password and a password to be verified
 * and returns a boolean indicating whether the password matches the
 * hashed password or not.
 *
 * @param {string} hashedData The hashed password. This is the password
 *                            that was previously hashed using the
 *                            encrypt() function.
 * @param {string} data The password to be verified. This is the password
 *                      that the user is trying to log in with.
 *
 * @returns {Promise<boolean>} A boolean indicating whether the password
 *                             matches the hashed password or not.
 */
async function verifyPassword(hashedData, data) {
  try {
    // Compare the user's password with the hashed password
    // The compare() function will return true if the password matches
    // the hashed password, or false if it does not.
    const isValid = await bcrypt.compare(data, hashedData);

    // Return the boolean indicating whether the password matches
    // the hashed password or not.
    return isValid;
  } catch (err) {
    // If there is an error, log it to the console
    console.error(err);
    // And rethrow the error so that it can be handled by the caller
    throw err;
  }
}

function cronStringFromDate(dateString) {
  const date = new Date(dateString);
  const minute = date.getMinutes();
  const hour = date.getHours();
  const day = date.getDate();
  const month = date.getMonth() + 1; // months are 0-based in JS
  return `${minute} ${hour} ${day} ${month} *`;
}


function signJwtToken(data , expiry = '1h') {
  const token = jwt.sign(data, JWT_SECRET , {
    expiresIn: expiry
  });

  return token;
}

module.exports = { encrypt, verifyPassword, cronStringFromDate , signJwtToken };
