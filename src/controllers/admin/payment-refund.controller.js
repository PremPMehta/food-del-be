const FastFoodOrderModel = require("../../models/fastfood-order.model");
const OrderModel = require("../../models/order.model");
const PaymentModel = require("../../models/payment.model");
const TransactionModel = require("../../models/transaction.model");
const { refundRazorpayOrder } = require("../../services/razorpay/razorpay");
const { ORDER_TYPE } = require("../../utils/constants");

const refundAmount = async (req, res) => {
  try {
    // const { orderId } = req.body;
    const { id, type } = req.params;
    let orderId;

    if (ORDER_TYPE.FASTFOOD === type) {
      const fastfoodOrder = await FastFoodOrderModel.findOne({ _id: id });
      if (!fastfoodOrder) {
        return res.status(400).json({ message: "fastfood order not found " });
      }

      const findTransaction = await TransactionModel.find({
        _id: { $in: fastfoodOrder.paymentIds },
      });
      const razorpayTransction = findTransaction.filter(
        (transaction) => transaction.payment_method === "razorpay"
      );

      if (razorpayTransction && razorpayTransction.length <= 0) {
        return res.status(400).json({ message: "transaction not Valid" });
      }

      const findPayment = await PaymentModel.findOne({
        _id: razorpayTransction[0].payment_id,
      });

      if (!findPayment) {
        return res
          .status(400)
          .json({ message: "Payment not found this Order" });
      }
      orderId = findPayment.order_id;
    } else if (ORDER_TYPE.THAL === type) {
      const fastfoodOrder = await OrderModel.findOne({ _id: id });
      if (!fastfoodOrder) {
        return res.status(400).json({ message: "fastfood order not found " });
      }

      const findTransaction = await TransactionModel.find({
        _id: { $in: fastfoodOrder.paymentIds },
      });
      const razorpayTransction = findTransaction.filter(
        (transaction) => transaction.payment_method === "razorpay"
      );

      if (!findTransaction) {
        return res.status(400).json({ message: "transaction not found " });
      }

      const findPayment = await PaymentModel.findOne({
        _id: razorpayTransction[0].payment_id,
      });

      if (!findPayment) {
        return res
          .status(400)
          .json({ message: "Payment not found this Order" });
      }
      orderId = findPayment.order_id;
    } else {
      return res.status(400).json({ message: "Invalid type" });
    }

    const refundData = {
      refund_description: `RazorPay amount refund at ${new Date().toISOString()}`,
      orderId: orderId,
    };

    const refund = await refundRazorpayOrder(refundData);
    if (!refund) {
      return res.status(400).json({ message: "refund process failed" });
    }

    if (refund.statusCode === 400) {
      return res.status(400).json({ message: "refund process failed", refund });
    }
    return res
      .status(200)
      .json({ message: "Amount successfully refuned", refund });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "internal server error",
      error: error || error.message,
    });
  }
};

module.exports = { refundAmount };
