const generateRandomString = () => {
  let randomStr;

  do {
    randomStr = Math.random().toString(36).substring(2, 5);
  } while (!isNaN(randomStr)); // Keep generating if it's a number

  return randomStr;
};

module.exports = generateRandomString;
