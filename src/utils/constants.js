const TRANSACTION_TYPE = {
  CREDIT: "credit",
  DEBIT: "debit",
};

// const PAYMENT_METHOD = {
//   PAYPAL: "paypal",
//   WALLET: "wallet",
//   REFERRAL_REWARD: "referral_reward",
// };

const PAYMENT_METHOD = {
  RAZORPAY: "razorpay",
  WALLET: "wallet",
  REFERRAL_REWARD: "referral_reward",
  ORDER_REWARD: "order_reward",
};

const PAYMENT_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
};

const TRANSACTION_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
};

const USER_ROLE = {
  USER: "user",
  ADMIN: "admin",
  SUPERADMIN: "superadmin",
};

const USER_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  INACTIVE: "inactive",
};

const DISH_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

const DISH_TYPE = {
  VEG: "Veg",
  NON_VEG: "Nonveg",
  VEGAN: "Vegan",
  EGGETARIAN: "Eggetarian",
  JAIN: "Jain",
};

const CATEGORY_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

// const ORDER_STATUS = {
//   PENDING: "pending",
//   ACCEPTED: "accepted",
//   COMPLETED: "completed",
//   CANCELLED: "cancelled",
//   REJECTED: "rejected",
// };

const ORDER_STATUS = {
  PENDING: "payment_link.pending",
  PAID: "payment_link.paid",
  FAILED: "payment_link.failed",
  EXPIRED: "payment_link.expired",
  CANCELLED: "payment_link.cancelled",
};

const ORDER_STATUS_MESSAGE = {
  PAYMENT_PENDING: "payment_pending",
  PENDING: "pending",
  ACCEPTED: "accepted",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REJECTED: "rejected",
};

const OPTIONS_PAYPAL_CODES = {
  "CHECKOUT-APPROVED": "CHECKOUT.ORDER.APPROVED",
  "CAPTURE-COMPLETED": "PAYMENT.CAPTURE.COMPLETED",
  VERIFIED: "SUCCESS",
  "PAYMENT-AUTHORIZATION-CREATED": "PAYMENT.AUTHORIZATION.CREATED",
  "PAYMENT-AUTHORIZATION-VOIDED": "PAYMENT.AUTHORIZATION.VOIDED",
  "PAYMENT-CAPTURE-DECLINED": "PAYMENT.CAPTURE.DECLINED",
  "PAYMENT-CAPTURE-COMPLETED": "PAYMENT.CAPTURE.COMPLETED",
  "PAYMENT-CAPTURE-PENDING": "PAYMENT.CAPTURE.PENDING",
  "PAYMENT-CAPTURE-REFUNDED": "PAYMENT.CAPTURE.REFUNDED",
  "PAYMENT-CAPTURE-REVERSE": "PAYMENT.CAPTURE.REVERSE",
};

const ORDER_TYPE = {
  THAL: "thal",
  PLATE: "plate",
  FASTFOOD: "fastfood",
};

const ORDER_PAYMENT_MODE = {
  WALLET: "wallet",
  PAYPAL: "paypal",
  BOTH: "both",
  RAZORPAY: "razorpay",
  COMBO: "wallet+razorpay",
};

const VESU_AREA_PINCODES = [110001, 110002, 110003, 110004, 110005, 110006];
module.exports = {
  TRANSACTION_TYPE,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  USER_ROLE,
  USER_STATUS,
  TRANSACTION_STATUS,
  OPTIONS_PAYPAL_CODES,
  DISH_STATUS,
  DISH_TYPE,
  CATEGORY_STATUS,
  ORDER_STATUS,
  VESU_AREA_PINCODES,
  ORDER_TYPE,
  ORDER_PAYMENT_MODE,
  ORDER_STATUS_MESSAGE,
};
