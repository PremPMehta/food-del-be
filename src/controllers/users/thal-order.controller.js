const OrderModel = require("../../models/order.model");
const FastFoodModel = require("../../models/fastfood-order.model");

const { ORDER_TYPE } = require("../../utils/constants");
const { getOrders, getOrderById } = require("../../common/allOrders");

// Paginated listing API
const getAllOrders = async (req, res) => {
  console.log("req.params.type", req.params.type);
  if (req.params.type === ORDER_TYPE.THAL) {
    return getOrders(req, res, OrderModel, ORDER_TYPE.THAL);
  } else if (req.params.type === ORDER_TYPE.FASTFOOD) {
    return getOrders(req, res, FastFoodModel, ORDER_TYPE.FASTFOOD);
  } else {
    return res.status(400).json({ message: "Provide Invalid Type" });
  }
};

const getAllOrderById = async (req, res) => {
  console.log("req.params.type", req.params.type);

  if (req.params.type === ORDER_TYPE.THAL) {
    return getOrderById(req, res, OrderModel);
  } else if (req.params.type === ORDER_TYPE.FASTFOOD) {
    return getOrderById(req, res, FastFoodModel);
  } else {
    return res.status(400).json({ message: "Provide Invalid Type" });
  }
};

module.exports = { getAllOrders, getAllOrderById };
