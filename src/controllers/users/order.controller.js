// Import the mongoose module to interact with MongoDB
const mongoose = require("mongoose");

// Import the yup module for schema validation
const yup = require("yup");

// Import the OrderModel which is a mongoose model representing an order in the database
const OrderModel = require("../../models/order.model");

// Import the DishModel which is a mongoose model representing a dish in the database
const DishModel = require("../../models/dish.model");

// Import the CategoryModel which is a mongoose model representing a category in the database
const CategoryModel = require("../../models/category.model");

// Import the ThalModel which is a mongoose model representing a thal in the database
const ThalModel = require("../../models/thal.model");

// Import the UserModel which is a mongoose model representing a user in the database
const UserModel = require("../../models/users.model");

// Import the TransactionModel which is a mongoose model representing a transaction in the database
const TransactionModel = require("../../models/transaction.model");

// Import the PaymentModel which is a mongoose model representing a payment in the database
const PaymentModel = require("../../models/payment.model");

const socketService = require('../../services/socket/socket.service');

const {
  ORDER_TYPE,
  ORDER_PAYMENT_MODE,
  ORDER_STATUS_MESSAGE,
  ORDER_STATUS,
  USER_STATUS,
  TRANSACTION_TYPE,
  PAYMENT_METHOD,
  TRANSACTION_STATUS,
} = require("../../utils/constants");
const { walletTopUp } = require("./wallet.controller");
const { paypalCreateOrder } = require("../../services/paypal/paypal");
const { FRONTEND_PAYMENT_REDIRECT_URL } = require("../../config/config");
const { createRazorpayOrder } = require("../../services/razorpay/razorpay");

const placeThalOrderSchema = yup.object().shape({
  deliveryDateTime: yup.date().required("Delivery date and time are required"),
  deliveryAddress: yup.object().shape({
    line1: yup.string().required("Address line 1 is required"),
    line2: yup.string().optional(), // Optional field
    city: yup.string().required("City is required"),
    pincode: yup.string().required("Pincode is required"),
  }),
  items: yup
    .array()
    .of(
      yup.object().shape({
        category: yup.string().required("Category ID is required"), // Category ID
        items: yup
          .array()
          .of(
            yup.object().shape({
              dish: yup.string().required("Dish ID is required"),
              quantity: yup
                .number()
                .required("Quantity is required")
                .min(1, "Quantity must be at least 1"),
              mrp: yup.number().required("MRP is required"),
              salePrice: yup.number().required("Sale price is required"),
              customizable: yup.boolean().default(false),
              diet: yup.string().required("Diet is required"),
              customizeCategories: yup
                .array()
                .of(
                  yup.object().shape({
                    _id: yup
                      .string()
                      .required("Customize category ID is required"),
                    title: yup
                      .string()
                      .required("Customize category title is required"),
                    allowMultiple: yup
                      .boolean()
                      .required("Allow multiple is required"),
                    limit: yup.number().required("Limit is required"),
                    options: yup
                      .array()
                      .of(
                        yup.object().shape({
                          _id: yup.string().required("Option ID is required"),
                          title: yup
                            .string()
                            .required("Option title is required"),
                          priceAddOn: yup
                            .number()
                            .required("Price add-on is required"),
                        })
                      )
                      .required("Options are required"),
                  })
                )
                .optional(), // Optional field
            })
          )
          .required("Items are required"),
      })
    )
    .required("Items are required"),
  thal_quantity: yup
    .number()
    .min(1, "Thal quantity must be at least 1")
    .required("Thal quantity is required"),
  total_per_thal: yup.number().required("Total per thal is required"),
  totalAmount: yup.number().required("Total amount is required"),
  orderType: yup
    .string()
    .oneOf(["thal", "plate", "fastfood"])
    .required("Order type is required"),
  payment_mode: yup
    .string()
    .oneOf(["wallet", "paypal", "both"])
    .required("Payment mode is required"),
  userComments: yup.string().optional(),
});

function areAllDietsJain(data) {
  // Iterate through each category
  for (let category of data) {
    // Iterate through each item in the category
    for (let item of category.items) {
      // Check if the diet is not Jain
      if (item.diet !== "Jain") {
        return false; // Return false if any item is not Jain
      }
    }
  }
  return true; // Return true if all items are Jain
}

function isDeliveryDateValid(deliveryDateTime) {
  // Get the current date and time
  const now = new Date();

  // Parse the delivery date time
  const deliveryDate = new Date(deliveryDateTime);

  // Check if the delivery date is in the future
  if (deliveryDate <= now) {
    return false; // Delivery date is not in the future
  }

  // Calculate the difference in time (in milliseconds)
  const timeDifference = deliveryDate - now;

  // Calculate the difference in days
  const daysDifference = timeDifference / (1000 * 60 * 60 * 24);

  // Check if the difference is more than 5 days
  if (daysDifference <= 5) {
    return false; // Delivery date is not more than 5 days away
  }

  return true; // Delivery date is valid
}

// const placeThalOrder = async (req, res) => {
//   const session = await mongoose.startSession();

//   try {
//     const validatedData = await placeThalOrderSchema.validate(req.body);

//     const orderData = {};

//     orderData.deliveryDateTime = validatedData.deliveryDateTime;
//     orderData.deliveryAddress = validatedData.deliveryAddress;
//     orderData.user = req.user._id;
//     orderData.userComments = validatedData.userComments;

//     orderData.orderType = ORDER_TYPE.THAL;
//     orderData.thal_quantity = validatedData.thal_quantity;

//     // variable for total per thal amount
//     let total_per_thal = 0;

//     // Get unique categories from items array
//     const uniqueCategories = new Set();
//     for (const item of validatedData.items) {
//       uniqueCategories.add(item.category);
//     }

//     // Convert Set to Array for further processing
//     const categoriesArray = Array.from(uniqueCategories);

//     // Fetch all category details with dish details in one query
//     const categoryDetails = await CategoryModel.find({
//       _id: { $in: categoriesArray },
//     }).populate({
//       path: "dishes",
//       model: DishModel,
//     });

//     // Add category details to orderData
//     // orderData.categories = categoryDetails;

//     let orderItems = [];

//     validatedData.items.forEach((orderCategoryItems) => {
//       const category = categoryDetails.find(
//         (cat) => cat._id.toString() === orderCategoryItems.category
//       );

//       if (!category) {
//         throw new Error(
//           `Category with ID ${orderCategoryItems.category} not found`
//         );
//       }

//       const payloadCategoryItems = [];

//       orderCategoryItems.items.forEach((orderDish) => {
//         const dish = category.dishes.find(
//           (dish) => dish._id.toString() === orderDish.dish
//         );

//         if (!dish) {
//           throw new Error(`Dish with ID ${orderDish.dish} not found`);
//         }

//         const dishItem = {
//           dish: dish._id,
//           title: dish.title,
//           imageUrl: dish.imageUrl,
//           quantity: orderDish.quantity,
//           mrp: dish.thalMrp,
//           salePrice: dish.thalSalePrice,
//           diet: dish.diet,
//           customizable: dish.customizable,
//           customizeCategories: [],
//         };

//         total_per_thal += dish.thalSalePrice * orderDish.quantity;

//         if (dish.customizable) {
//           orderDish.customizeCategories?.forEach(
//             (orderDishCustomizeCategory) => {
//               const dishCustomizeCategory = dish.customizeCategories.find(
//                 (category) =>
//                   category._id.toString() === orderDishCustomizeCategory._id
//               );

//               if (!dishCustomizeCategory) {
//                 throw new Error(
//                   `Customize category with ID ${orderDishCustomizeCategory._id} not found in dish ${dish.title} of category ${category.title}`
//                 );
//               }

//               const orderDishCustomizeCategoryPayload = {
//                 _id: dishCustomizeCategory._id,
//                 title: dishCustomizeCategory.title,
//                 allowMultiple: dishCustomizeCategory.allowMultiple,
//                 limit: dishCustomizeCategory.limit,
//                 options: [],
//               };

//               if (
//                 !(
//                   orderDishCustomizeCategoryPayload.options.length <
//                   dishCustomizeCategory.limit
//                 )
//               ) {
//                 throw new Error(
//                   `Maximum limit of ${dishCustomizeCategory.limit} for customize category ${dishCustomizeCategory.title} of dish ${dish.title} of category ${category.title} is reached`
//                 );
//               }

//               orderDishCustomizeCategory.options?.forEach(
//                 (orderDishCustomizeCategoryOption) => {
//                   const dishCustomizeCategoryOption =
//                     dishCustomizeCategory.options.find(
//                       (option) =>
//                         option._id.toString() ===
//                         orderDishCustomizeCategoryOption._id
//                     );

//                   if (!dishCustomizeCategoryOption) {
//                     throw new Error(
//                       `Option with ID ${orderDishCustomizeCategoryOption._id} not found in customize category ${dishCustomizeCategory.title} of dish ${dish.title} of category ${category.title}`
//                     );
//                   }

//                   orderDishCustomizeCategoryPayload.options.push({
//                     _id: dishCustomizeCategoryOption._id,
//                     title: dishCustomizeCategoryOption.title,
//                     priceAddOn: dishCustomizeCategoryOption.priceAddOn,
//                   });

//                   total_per_thal +=
//                     dishCustomizeCategoryOption.priceAddOn * orderDish.quantity;
//                 }
//               );

//               dishItem.customizeCategories.push(
//                 orderDishCustomizeCategoryPayload
//               );
//             }
//           );
//         }

//         payloadCategoryItems.push(dishItem);
//       });

//       const categoryPayload = {
//         category: category._id,
//         category_title: category.title,
//         items: payloadCategoryItems,
//       };

//       orderItems.push(categoryPayload);
//     });

//     orderData.items = orderItems;
//     orderData.thal_price = total_per_thal;

//     orderData.totalAmount = total_per_thal * validatedData.thal_quantity;

//     // if date and time is in less than 5 future dates make it pending or else make it accepted
//     if (isDeliveryDateValid(validatedData.deliveryDateTime)) {
//       orderData.status = ORDER_STATUS.ACCEPTED;
//     } else {
//       orderData.status = ORDER_STATUS.PENDING;
//     }

//     // if all the dish in the items is jain then mark it as isJain

//     orderData.isJain = areAllDietsJain(orderData.items);

//     orderData.payment_mode = ORDER_PAYMENT_MODE.WALLET;

//     // Now check if the wallet as enough balance to process this order.

//     const user = await UserModel.findById(req.user._id);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     if (user.status === USER_STATUS.INACTIVE) {
//       return res.status(400).json({ message: "User is inactive" });
//     }

//     if (orderData.totalAmount > user.walletBalance) {
//       throw new Error(
//         `Wallet balance is not enough to process this order , please top up your wallet with atleast ${(
//           orderData.totalAmount - user.walletBalance
//         ).toFixed(2)} and try again`
//       );
//     }

//     orderData.name = user.name;
//     orderData.email = user.email;
//     orderData.phone = user.phone;

//     // session.startTransaction(); // Start the transaction immediately after creating the session

//     const transactionPayloadCreation = {
//       user_id: user._id,
//       transaction_type: TRANSACTION_TYPE.DEBIT,
//       description: `Order placed for thal at ${
//         orderData.deliveryDateTime
//       } for ${orderData.thal_quantity} thal at ${new Date().toISOString()}`,
//       payment_method: PAYMENT_METHOD.WALLET,
//       amount: orderData.totalAmount,
//       status: TRANSACTION_STATUS.COMPLETED,
//       walletTopUp: false,
//     };

//     const transaction = new TransactionModel(transactionPayloadCreation);
//     await transaction.save({ session });

//     const paymentHistoryRecord = {
//       amount: orderData.totalAmount,
//       transaction_id: transaction._id,
//       starting_balance: user.walletBalance,
//       transaction_Type: TRANSACTION_TYPE.DEBIT,
//       closing_balance: user.walletBalance - orderData.totalAmount,
//       description: `Order placed for thal at ${
//         orderData.deliveryDateTime
//       } for ${orderData.thal_quantity} thal at ${new Date().toISOString()}`,
//     };

//     user.paymentHistory.unshift(paymentHistoryRecord);
//     user.walletBalance -= orderData.totalAmount;

//     await user.save({ session });

//     orderData.paymentIds = [transaction._id];

//     const order = new OrderModel(orderData);

//     // // Save the order to the database
//     await order.save({ session });

//     // Return the order data with populated category details
//     return res.status(200).json(order);

//     // Uncomment the following lines to save the order to the database
//     // const order = new OrderModel(orderData);
//     // await order.save();
//     // res.status(201).json(order);
//   } catch (error) {
//     session.abortTransaction();
//     session.endSession();
//     res.status(400).json({ error: error.message });
//   }
// };

const placeThalOrder = async (req, res) => {
  try {
    const validatedData = await placeThalOrderSchema.validate(req.body);

    const orderData = {};

    orderData.deliveryDateTime = validatedData.deliveryDateTime;
    orderData.deliveryAddress = validatedData.deliveryAddress;
    orderData.user = req.user._id;
    orderData.userComments = validatedData.userComments;

    orderData.orderType = ORDER_TYPE.THAL;
    orderData.thal_quantity = validatedData.thal_quantity;

    // variable for total per thal amount
    let total_per_thal = 0;

    // Get unique categories from items array
    const uniqueCategories = new Set();
    for (const item of validatedData.items) {
      uniqueCategories.add(item.category);
    }

    // Convert Set to Array for further processing
    const categoriesArray = Array.from(uniqueCategories);

    // Fetch all category details with dish details in one query
    const categoryDetails = await CategoryModel.find({
      _id: { $in: categoriesArray },
    }).populate({
      path: "dishes",
      model: DishModel,
    });

    // Add category details to orderData
    // orderData.categories = categoryDetails;

    let orderItems = [];

    validatedData.items.forEach((orderCategoryItems) => {
      const category = categoryDetails.find(
        (cat) => cat._id.toString() === orderCategoryItems.category
      );

      if (!category) {
        throw new Error(
          `Category with ID ${orderCategoryItems.category} not found`
        );
      }

      const payloadCategoryItems = [];

      orderCategoryItems.items.forEach((orderDish) => {
        const dish = category.dishes.find(
          (dish) => dish._id.toString() === orderDish.dish
        );

        if (!dish) {
          throw new Error(`Dish with ID ${orderDish.dish} not found`);
        }

        const dishItem = {
          dish: dish._id,
          title: dish.title,
          imageUrl: dish.imageUrl,
          quantity: orderDish.quantity,
          mrp: dish.thalMrp,
          salePrice: dish.thalSalePrice,
          diet: dish.diet,
          customizable: dish.customizable,
          customizeCategories: [],
        };

        total_per_thal += dish.thalSalePrice * orderDish.quantity;

        if (dish.customizable) {
          orderDish.customizeCategories?.forEach(
            (orderDishCustomizeCategory) => {
              const dishCustomizeCategory = dish.customizeCategories.find(
                (category) =>
                  category._id.toString() === orderDishCustomizeCategory._id
              );

              if (!dishCustomizeCategory) {
                throw new Error(
                  `Customize category with ID ${orderDishCustomizeCategory._id} not found in dish ${dish.title} of category ${category.title}`
                );
              }

              const orderDishCustomizeCategoryPayload = {
                _id: dishCustomizeCategory._id,
                title: dishCustomizeCategory.title,
                allowMultiple: dishCustomizeCategory.allowMultiple,
                limit: dishCustomizeCategory.limit,
                options: [],
              };

              if (
                !(
                  orderDishCustomizeCategoryPayload.options.length <
                  dishCustomizeCategory.limit
                )
              ) {
                throw new Error(
                  `Maximum limit of ${dishCustomizeCategory.limit} for customize category ${dishCustomizeCategory.title} of dish ${dish.title} of category ${category.title} is reached`
                );
              }

              orderDishCustomizeCategory.options?.forEach(
                (orderDishCustomizeCategoryOption) => {
                  const dishCustomizeCategoryOption =
                    dishCustomizeCategory.options.find(
                      (option) =>
                        option._id.toString() ===
                        orderDishCustomizeCategoryOption._id
                    );

                  if (!dishCustomizeCategoryOption) {
                    throw new Error(
                      `Option with ID ${orderDishCustomizeCategoryOption._id} not found in customize category ${dishCustomizeCategory.title} of dish ${dish.title} of category ${category.title}`
                    );
                  }

                  orderDishCustomizeCategoryPayload.options.push({
                    _id: dishCustomizeCategoryOption._id,
                    title: dishCustomizeCategoryOption.title,
                    priceAddOn: dishCustomizeCategoryOption.priceAddOn,
                  });

                  total_per_thal +=
                    dishCustomizeCategoryOption.priceAddOn * orderDish.quantity;
                }
              );

              dishItem.customizeCategories.push(
                orderDishCustomizeCategoryPayload
              );
            }
          );
        }

        payloadCategoryItems.push(dishItem);
      });

      const categoryPayload = {
        category: category._id,
        category_title: category.title,
        items: payloadCategoryItems,
      };

      orderItems.push(categoryPayload);
    });

    orderData.items = orderItems;
    orderData.thal_price = total_per_thal;

    orderData.totalAmount = total_per_thal * validatedData.thal_quantity;

    // if date and time is in less than 5 future dates make it pending or else make it accepted
    if (isDeliveryDateValid(validatedData.deliveryDateTime)) {
      orderData.status = ORDER_STATUS_MESSAGE.ACCEPTED;
    } else {
      orderData.status = ORDER_STATUS_MESSAGE.PENDING;
    }

    // if all the dish in the items is jain then mark it as isJain

    orderData.isJain = areAllDietsJain(orderData.items);

    orderData.payment_mode = ORDER_PAYMENT_MODE.WALLET;

    // Now check if the wallet as enough balance to process this order.

    const user = await UserModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status === USER_STATUS.INACTIVE) {
      return res.status(400).json({ message: "User is inactive" });
    }

    if (orderData.totalAmount > user.walletBalance) {
      if (user.walletBalance > 0) {
        const paymentsIds = [];

        let restPayment = orderData.totalAmount - user.walletBalance;
        console.log("restPayment", restPayment);

        const transactionPayloadCreation = {
          user_id: user._id,
          transaction_type: TRANSACTION_TYPE.DEBIT,
          description: `Order placed for thal at ${
            orderData.deliveryDateTime
          } for ${orderData.thal_quantity} thal at ${new Date().toISOString()}`,
          payment_method: PAYMENT_METHOD.WALLET,
          amount: user.walletBalance,
          status: TRANSACTION_STATUS.COMPLETED,
          walletTopUp: false,
        };

        const transaction = new TransactionModel(transactionPayloadCreation);
        // await transaction.save({ session });
        await transaction.save();
        paymentsIds.push(transaction._id);

        const paymentHistoryRecord = {
          amount: orderData.totalAmount,
          transaction_id: transaction._id,
          starting_balance: user.walletBalance,
          transaction_Type: TRANSACTION_TYPE.DEBIT,
          closing_balance: user.walletBalance - user.walletBalance,
          description: `Order placed for thal at ${
            orderData.deliveryDateTime
          } for ${orderData.thal_quantity} thal at ${new Date().toISOString()}`,
        };

        user.paymentHistory.unshift(paymentHistoryRecord);
        user.walletBalance -= user.walletBalance;

        await user.save();

        orderData.payment_mode = ORDER_PAYMENT_MODE.BOTH;

        const paymentData = {
          order_description: `Order placed for thal at ${
            orderData.deliveryDateTime
          } for ${orderData.thal_quantity} thal at ${new Date().toISOString()}`,
          amount: restPayment,
          return_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/orders/payment/success`,
          cancel_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/orders/payment/failed`,
          user_id: user._id,
          wallet_topUp: false,
          order_topUp: true,
        };
        console.log("paymentData------------------------>", paymentData);
        // const payment = await paypalCreateOrder(paymentData);
        const payment = await createRazorpayOrder(paymentData);
        console.log("payment------------------------>", payment);

        if (!payment) {
          throw new Error({
            message: "Payment creation failed.",
            code: 500,
          });
        }

        orderData.name = user.name;
        orderData.email = user.email;
        orderData.phone = user.phone;

        console.log(
          "payment.createTransaction._id------------------------>",
          payment.createTransaction._id
        );
        paymentsIds.push(payment.createTransaction._id);
        orderData.paymentIds = paymentsIds;
        orderData.status = ORDER_STATUS_MESSAGE.PAYMENT_PENDING;

        const order = new OrderModel(orderData);

        let data = await order.save();
        const io = socketService.getIO();

        // Emit events
        io.emit('thal_order', {
          action: 'create',
          order: data
        });
        console.log("oerder data---------------->", data);
        // await order.save({ session });
        // Return the order data with populated category details

        // return res.status(200).json({
        //   message: "Payment created successfully",
        //   payment_link: payment.payment_link,
        // });
        return res.status(200).json({
          status: 200,
          message: "Payment created successfully",
          data: {
            orderId: data._id,
            payment_link: payment.payment_link,
          },
        });
      } else {
        orderData.payment_mode = ORDER_PAYMENT_MODE.RAZORPAY;

        const paymentData = {
          order_description: `Order placed for thal at ${
            orderData.deliveryDateTime
          } for ${orderData.thal_quantity} thal at ${new Date().toISOString()}`,
          amount: orderData.totalAmount,
          return_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/orders/payment/success`,
          cancel_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/orders/payment/failed`,
          user_id: user._id,
          wallet_topUp: false,
          order_topUp: true,
        };
        console.log("paymentData------------------------>", paymentData);
        // const payment = await paypalCreateOrder(paymentData);
        const payment = await createRazorpayOrder(paymentData);
        console.log("payment------------------------>", payment);

        if (!payment) {
          throw new Error({
            message: "Payment creation failed.",
            code: 500,
          });
        }

        orderData.name = user.name;
        orderData.email = user.email;
        orderData.phone = user.phone;

        console.log(
          "payment.createTransaction._id------------------------>",
          payment.createTransaction._id
        );

        orderData.paymentIds = [payment.createTransaction._id];

        orderData.status = ORDER_STATUS_MESSAGE.PAYMENT_PENDING;

        const order = new OrderModel(orderData);


        let data = await order.save();
        console.log("oerder data---------------->", data);

        const io = socketService.getIO();

        // Emit events
        io.emit('thal_order', {
          action: 'create',
          order: data
        });
        // await order.save({ session });
        // Return the order data with populated category details

        // return res.status(200).json({
        //   message: "Payment created successfully",
        //   payment_link: payment.payment_link,
        // });
        return res.status(200).json({
          status: 200,
          message: "Payment created successfully",
          data: {
            orderId: data._id,
            payment_link: payment.payment_link,
          },
        });
      }
      // end payment
    } else {
      orderData.name = user.name;
      orderData.email = user.email;
      orderData.phone = user.phone;

      // session.startTransaction(); // Start the transaction immediately after creating the session

      const transactionPayloadCreation = {
        user_id: user._id,
        transaction_type: TRANSACTION_TYPE.DEBIT,
        description: `Order placed for thal at ${
          orderData.deliveryDateTime
        } for ${orderData.thal_quantity} thal at ${new Date().toISOString()}`,
        payment_method: PAYMENT_METHOD.WALLET,
        amount: orderData.totalAmount,
        status: TRANSACTION_STATUS.COMPLETED,
        walletTopUp: false,
      };

      const transaction = new TransactionModel(transactionPayloadCreation);
      // await transaction.save({ session });
      await transaction.save();

      const paymentHistoryRecord = {
        amount: orderData.totalAmount,
        transaction_id: transaction._id,
        starting_balance: user.walletBalance,
        transaction_Type: TRANSACTION_TYPE.DEBIT,
        closing_balance: user.walletBalance - orderData.totalAmount,
        description: `Order placed for thal at ${
          orderData.deliveryDateTime
        } for ${orderData.thal_quantity} thal at ${new Date().toISOString()}`,
      };

      user.paymentHistory.unshift(paymentHistoryRecord);
      user.walletBalance -= orderData.totalAmount;

      await user.save();
      // await user.save({ session });

      orderData.paymentIds = [transaction._id];

      const order = new OrderModel(orderData);
      const io = socketService.getIO();
            
                    // Emit events
                    io.emit('thal_order', {
                      action: 'create',
                      order: order
                    });

      // // Save the order to the database

      await order.save();
      // await order.save({ session });
      // Return the order data with populated category details

      return res.status(200).json({
        data: order,
        status: 201,
      });

      // Uncomment the following lines to save the order to the database
      // const order = new OrderModel(orderData);
      // await order.save();
      // res.status(201).json(order);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const listUserOrders = async (req, res) => {
  try {
    const orders = await OrderModel.find({ user: req.user._id }).populate(
      "items.category"
    );
    res.status(200).json(orders);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getThalPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    let orderDetails = await OrderModel.findOne({
      _id: orderId,
      payment_mode: {
        $in: [
          ORDER_PAYMENT_MODE.BOTH,
          ORDER_PAYMENT_MODE.WALLET,
          ORDER_PAYMENT_MODE.RAZORPAY,
        ],
      },
    })?.populate("paymentIds");

    let orderDetailsStatus = orderDetails?.paymentIds?.every((value) => {
      return value.status === "completed";
    });
    return res.status(200).json({
      data: {
        orderDetails,
        payment_status: orderDetailsStatus ? "completed" : "pending",
      },
      message: "Order details fetched successfully.",
      status: 200,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};
module.exports = { placeThalOrder, listUserOrders, getThalPaymentStatus };
