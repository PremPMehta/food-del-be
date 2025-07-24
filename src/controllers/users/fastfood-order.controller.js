const mongoose = require("mongoose");

// Import the yup module for schema validation
const yup = require("yup");

// Import the OrderModel which is a mongoose model representing an order in the database
const fastfoodOrderModel = require("../../models/fastfood-order.model");

// Import the DishModel which is a mongoose model representing a dish in the database
const DishModel = require("../../models/dish.model");

// Import the CategoryModel which is a mongoose model representing a category in the database
const CategoryModel = require("../../models/category.model");

// Import the ThalModel which is a mongoose model representing a thal in the database
// const ThalModel = require("../../models/thal.model");

// Import the UserModel which is a mongoose model representing a user in the database
const UserModel = require("../../models/users.model");

// Import the TransactionModel which is a mongoose model representing a transaction in the database
const TransactionModel = require("../../models/transaction.model");

const comboMeals = require("../../models/combo.model");
const kitchenModel = require("../../models/kitchen.model");
const path = require("path");
const billsDirectory = path.join(__dirname, "../../bills");

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

const { FRONTEND_PAYMENT_REDIRECT_URL } = require("../../config/config");
const { createRazorpayOrder } = require("../../services/razorpay/razorpay");
const generateRandomString = require("../../common/randomString");
const generateInvoicePDF = require("../../common/invoice");
const sendMail = require("../../utils/mailer");
const socketService = require("../../services/socket/socket.service");

const placeThalOrderSchema = yup.object().shape({
  // deliveryDateTime: yup.date().required("Delivery date and time are required"),
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
              // mrp: yup.number().required("MRP is required"),
              // salePrice: yup.number().required("Sale price is required"),
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
  // thal_quantity: yup
  //   .number()
  //   .min(1, "Thal quantity must be at least 1")
  //   .required("Thal quantity is required"),
  // totalOrderAmount: yup.number().required("Total per thal is required"),
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

function determineKitchen(item) {
  for (let data of item) {
    // console.log("determineKitchen", data.items);
    const hasNonVeg = data.items.some((item) => item.diet !== "Veg");
    return !hasNonVeg;
  }
}

const placeFastfoodOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const validatedData = await placeThalOrderSchema.validate(req.body);

    const user = await UserModel.findById(req.user._id);
    if (!user) {
      await session.abortTransaction(); // Abort transaction on error
      session.endSession(); // End session
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status === USER_STATUS.INACTIVE) {
      await session.abortTransaction(); // Abort transaction on error
      session.endSession(); // End session
      return res.status(400).json({ message: "User is inactive" });
    }

    const orderData = {};

    orderData.deliveryAddress = validatedData.deliveryAddress;
    orderData.user = req.user._id;
    orderData.userComments = validatedData.userComments;
    orderData.orderType = ORDER_TYPE.FASTFOOD;

    // variable for total per thal amount
    let totalOrderAmount = 0;

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
    })
      .populate({
        path: "dishes",
        model: DishModel,
      })
      .session(session);

    // Add category details to orderData
    // orderData.categories = categoryDetails;

    let orderItems = [];
    let comboItems = [];

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
          mrp: dish.normalMrp,
          salePrice: dish.normalSalePrice,
          diet: dish.diet,
          customizable: dish.customizable,
          customizeCategories: [],
        };

        // console.log("dish.salePrice", dish.normalSalePrice);
        // console.log("orderDish.quantity", orderDish.quantity);

        totalOrderAmount += dish.normalSalePrice * orderDish.quantity;

        // console.log("totalOrderAmount", totalOrderAmount);

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

                  totalOrderAmount +=
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

    // track veg or nonveg

    orderData.items = orderItems;
    // orderData.thal_price = totalOrderAmount;
    //
    // orderData.totalAmount = totalOrderAmount;

    // if all the dish in the items is jain then mark it as isJain

    orderData.isJain = areAllDietsJain(orderData.items);

    if (req.body.combos) {
      // Get unique categories from items array
      const uniqueCombo = new Set();

      for (const item of req.body.combos) {
        uniqueCombo.add(item.comboId);
      }

      // Convert Set to Array for further processing
      const combosArray = Array.from(uniqueCombo);

      // Fetch all category details with dish details in one query
      const comboDetails = await comboMeals
        .find({
          _id: { $in: combosArray },
          isDeleted: false,
        })
        .populate({
          path: "dishes",
          model: DishModel,
        })
        .session(session);

      const requestCombos = req.body.combos;

      const comboDetailsList = {};
      const comboDetailsIds = comboDetails?.forEach((record) => {
        comboDetailsList[record?._id?.toString()] = record;
      });
      const payloadCombos = [];

      // console.log("comboDetailsList : ", comboDetailsList);
      requestCombos?.forEach((record) => {
        if (!comboDetailsList?.[record?.comboId]) {
          return res.status(400).json({
            message: `Combo ${record?.comboId} not found.`,
          });
        } else {
          const comboDetail = comboDetailsList?.[record?.comboId];
          totalOrderAmount += comboDetail?.amount * record?.quantity;

          const comboItemPayload = {
            combo: comboDetail._id,
            title: comboDetail.title,
            thumbnail: comboDetail.thumbnail,
            quantity: record?.quantity,
            amount: comboDetail?.amount,
            diet: comboDetail?.diet,
          };

          payloadCombos.push(comboItemPayload);
        }
      });

      orderData.combos = payloadCombos;
    }

    // Now check if the wallet as enough balance to process this order.
    orderData.totalAmount = totalOrderAmount;

    const pincodes = validatedData?.deliveryAddress.pincode;

    const isOrderAllVeg = determineKitchen(orderData.items);

    console.log("isOrderAllVeg", isOrderAllVeg);

    if (isOrderAllVeg) {
      const findAllVegKitchenWithPincode = await kitchenModel
        .findOne({
          pincodes: { $in: pincodes },
          vegOnly: true,
        })
        .session(session);

      console.log(
        "veg only kitchen with pincode : ",
        findAllVegKitchenWithPincode
      );

      if (findAllVegKitchenWithPincode) {
        orderData.kitchen = findAllVegKitchenWithPincode?._id;
      } else {
        const findMasterVegKitchen = await kitchenModel
          .findOne({
            vegOnly: true,
            matserKitchen: true,
          })
          .session(session);

        console.log("veg only , master kitchen : ", findMasterVegKitchen);
        if (findMasterVegKitchen) {
          orderData.kitchen = findMasterVegKitchen?._id;
        } else {
          const findMasterKitchen = await kitchenModel
            .findOne({
              masterKitchen: true,
            })
            .session(session);

          console.log(" master kitchen : ", findMasterKitchen);

          orderData.kitchen = findMasterKitchen?._id;
        }
      }
    } else {
      const findMasterKitchenWithPincode = await kitchenModel
        .findOne({
          vegOnly: false,
          pincodes: { $in: pincodes },
        })
        .session(session);

      if (findMasterKitchenWithPincode) {
        orderData.kitchen = findMasterKitchenWithPincode?._id;
      } else {
        const findMasterKitchen = await kitchenModel
          .findOne({
            vegOnly: false,
            masterKitchen: true,
          })
          .session(session);

        orderData.kitchen = findMasterKitchen?._id;
      }
    }

    // if (orderData.totalAmount > user.walletBalance) {
    //   // throw new Error(
    //   //   `Wallet balance is not enough to process this order , please top up your wallet with atleast ${(
    //   //     orderData.totalAmount - user.walletBalance
    //   //   ).toFixed(2)} and try again`
    //   // );
    //   orderData.payment_mode = ORDER_PAYMENT_MODE.RAZORPAY;
    //   const paymentData = {
    //     order_description: `RazorPay through Order placed fastfood at ${new Date().toISOString()}`,
    //     amount: orderData.totalAmount,
    //     return_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/orders/payment/success`,
    //     cancel_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/orders/payment/failed`,
    //     user_id: user._id,
    //     wallet_topUp: false,
    //     order_topUp: true,
    //   };
    //   // console.log("paymentData------------------------>", paymentData);
    //   // const payment = await paypalCreateOrder(paymentData);
    //   const payment = await createRazorpayOrder(paymentData);
    //   // console.log("payment------------------------>", payment);

    //   if (!payment) {
    //     throw new Error({
    //       message: "Payment creation failed.",
    //       code: 500,
    //     });
    //   }

    //   orderData.name = user.name;
    //   orderData.email = user.email;
    //   orderData.phone = user.phone;

    //   orderData.paymentIds = payment.createTransaction._id;
    //   orderData.status = ORDER_STATUS_MESSAGE.PAYMENT_PENDING;
    //   const order = new fastfoodOrderModel(orderData);
    //   // await order.save({ session });
    //   // Return the order data with populated category details

    //   let orderPlacedData = await order.save({ session });

    //   await session.commitTransaction();
    //   session.endSession();

    //   return res.status(200).json({
    //     status: 200,
    //     message: "Payment created successfully",
    //     data: {
    //       orderId: orderPlacedData._id,
    //       payment_link: payment.payment_link,
    //     },
    //   });

    //   // end payment
    // } else {
    if (orderData.totalAmount > user.walletBalance) {
      if (user.walletBalance > 0) {
        const paymentsIds = [];
        let restPayment = orderData.totalAmount - user.walletBalance;

        console.log("restPayment", restPayment);
        // session.startTransaction(); // Start the transaction immediately after creating the session

        const transactionPayloadCreation = {
          user_id: user._id,
          transaction_type: TRANSACTION_TYPE.DEBIT,
          description: `Order placed for fastfood at ${new Date().toISOString()}`,
          payment_method: PAYMENT_METHOD.WALLET,
          amount: user.walletBalance,
          status: TRANSACTION_STATUS.COMPLETED,
          walletTopUp: false,
        };

        const transaction = new TransactionModel(transactionPayloadCreation);
        // await transaction.save({ session });
        await transaction.save({ session });
        paymentsIds.push(transaction._id);
        const paymentHistoryRecord = {
          amount: user.walletBalance,
          transaction_id: transaction._id,
          starting_balance: user.walletBalance,
          transaction_Type: TRANSACTION_TYPE.DEBIT,
          closing_balance: user.walletBalance - user.walletBalance,
          description: `Order placed for fastfood at ${new Date().toISOString()}`,
        };

        user.paymentHistory.unshift(paymentHistoryRecord);
        user.walletBalance -= user.walletBalance;

        await user.save();

        orderData.payment_mode = ORDER_PAYMENT_MODE.BOTH;
        const paymentData = {
          order_description: `RazorPay through Order placed fastfood at ${new Date().toISOString()}`,
          amount: restPayment,
          return_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/orders/payment/success`,
          cancel_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/orders/payment/failed`,
          user_id: user._id,
          wallet_topUp: false,
          order_topUp: true,
        };
        // console.log("paymentData------------------------>", paymentData);
        // const payment = await paypalCreateOrder(paymentData);
        const payment = await createRazorpayOrder(paymentData);
        // console.log("payment------------------------>", payment);

        if (!payment) {
          throw new Error({
            message: "Payment creation failed.",
            code: 500,
          });
        }
        orderData.name = user.name;
        orderData.email = user.email;
        orderData.phone = user.phone;
        paymentsIds.push(payment.createTransaction._id);

        console.log("paymentsIds------------->", paymentsIds);
        orderData.paymentIds = paymentsIds;
        orderData.status = ORDER_STATUS_MESSAGE.PAYMENT_PENDING;
        const order = new fastfoodOrderModel(orderData);
        // await order.save({ session });
        // Return the order data with populated category details

        let orderPlacedData = await order.save({ session });

        const io = socketService.getIO();
      
              // Emit events
              io.emit('new_order', {
                action: 'create',
                order: orderPlacedData
              });

        await session.commitTransaction();
        session.endSession();

        console.log("Order----------------> ", order);
        let billData = [];
        order.items.map((itemValue) => {
          itemValue.items.map((itemData) => {
            billData.push({
              name: itemData.title,
              quantity: itemData.quantity,
              price: itemData.salePrice,
            });
          });
        });

        console.log(billData);
        const invoiceData = {
          invoiceNumber: "Amafhh-1234",
          date: new Date().toLocaleDateString(),

          items: billData,
          subtotal: orderData.totalAmount,
          tax: 0, // 8% tax
          total: orderData.totalAmount,
        };

        const filePath = `${billsDirectory}/order-${generateRandomString()}.pdf`;
        const customerEmail = order.email;

        // Generate PDF and Send Email
        generateInvoicePDF(invoiceData, filePath)
          .then(() =>
            sendMail({
              filename: "Order Details.pdf",
              email: customerEmail,
              filePath: filePath,
            })
          )
          .catch((error) => console.error("Error:", error));

        return res.status(200).json({
          status: 200,
          message: "Payment created successfully",
          data: {
            orderId: orderPlacedData._id,
            payment_link: payment.payment_link,
          },
        });
      } else {
        orderData.payment_mode = ORDER_PAYMENT_MODE.RAZORPAY;

        const paymentData = {
          order_description: `RazorPay through Order placed fastfood at ${new Date().toISOString()}`,
          amount: orderData.totalAmount,
          return_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/orders/payment/success`,
          cancel_url: `${FRONTEND_PAYMENT_REDIRECT_URL}/orders/payment/failed`,
          user_id: user._id,
          wallet_topUp: false,
          order_topUp: true,
        };
        // console.log("paymentData------------------------>", paymentData);
        // const payment = await paypalCreateOrder(paymentData);
        const payment = await createRazorpayOrder(paymentData);
        // console.log("payment------------------------>", payment);

        if (!payment) {
          throw new Error({
            message: "Payment creation failed.",
            code: 500,
          });
        }
        orderData.name = user.name;
        orderData.email = user.email;
        orderData.phone = user.phone;

        orderData.paymentIds = [payment.createTransaction._id];

        orderData.status = ORDER_STATUS_MESSAGE.PAYMENT_PENDING;

        const order = new fastfoodOrderModel(orderData);
        // await order.save({ session });
        // Return the order data with populated category details

        let orderPlacedData = await order.save({ session });

        const io = socketService.getIO();
      
              // Emit events
              io.emit('new_order', {
                action: 'create',
                order: orderPlacedData
              });

        await session.commitTransaction();
        session.endSession();

        console.log("Order----------------> ", order);
        let billData = [];
        order.items.map((itemValue) => {
          itemValue.items.map((itemData) => {
            billData.push({
              name: itemData.title,
              quantity: itemData.quantity,
              price: itemData.salePrice,
            });
          });
        });

        console.log(billData);
        const invoiceData = {
          invoiceNumber: "Amafhh-1234",
          date: new Date().toLocaleDateString(),

          items: billData,
          subtotal: orderData.totalAmount,
          tax: 0, // 8% tax
          total: orderData.totalAmount,
        };

        const filePath = `${billsDirectory}/order-${generateRandomString()}.pdf`;
        const customerEmail = order.email;

        // Generate PDF and Send Email
        generateInvoicePDF(invoiceData, filePath)
          .then(() =>
            sendMail({
              filename: "Order Details.pdf",
              email: customerEmail,
              filePath: filePath,
            })
          )
          .catch((error) => console.error("Error:", error));

        return res.status(200).json({
          status: 200,
          message: "Payment created successfully",
          data: {
            orderId: orderPlacedData._id,
            payment_link: payment.payment_link,
          },
        });
      }
    } else {
      orderData.payment_mode = ORDER_PAYMENT_MODE.WALLET;
      orderData.name = user.name;
      orderData.email = user.email;
      orderData.phone = user.phone;

      // session.startTransaction(); // Start the transaction immediately after creating the session

      const transactionPayloadCreation = {
        user_id: user._id,
        transaction_type: TRANSACTION_TYPE.DEBIT,
        description: `Order placed for fastfood at ${new Date().toISOString()}`,
        payment_method: PAYMENT_METHOD.WALLET,
        amount: orderData.totalAmount,
        status: TRANSACTION_STATUS.COMPLETED,
        walletTopUp: false,
      };

      const transaction = new TransactionModel(transactionPayloadCreation);
      // await transaction.save({ session });
      await transaction.save({ session });

      const paymentHistoryRecord = {
        amount: orderData.totalAmount,
        transaction_id: transaction._id,
        starting_balance: user.walletBalance,
        transaction_Type: TRANSACTION_TYPE.DEBIT,
        closing_balance: user.walletBalance - orderData.totalAmount,
        description: `Order placed for fastfood at ${new Date().toISOString()}`,
      };

      user.paymentHistory.unshift(paymentHistoryRecord);
      user.walletBalance -= orderData.totalAmount;

      await user.save();

      // await user.save({ session });
      // console.log("transaction._id", transaction._id);

      orderData.paymentIds = [transaction._id];
      orderData.status = ORDER_STATUS_MESSAGE.PENDING;

      // // Save the order to the database

      const order = new fastfoodOrderModel(orderData);

      let data = await order.save({ session });

       const io = socketService.getIO();
      
              // Emit events
              io.emit('new_order', {
                action: 'create',
                order: data
              });

      await session.commitTransaction();
      session.endSession();

      // console.log("---------------------------->", data);
      // console.log(orderData.items);

      // await order.save({ session });
      // Return the order data with populated category details

      console.log("Order----------------> ", order);
      let billData = [];
      order.items.map((itemValue) => {
        itemValue.items.map((itemData) => {
          billData.push({
            name: itemData.title,
            quantity: itemData.quantity,
            price: itemData.salePrice,
          });
        });
      });

      console.log(billData);
      const invoiceData = {
        invoiceNumber: "Amafhh-1234",
        date: new Date().toLocaleDateString(),

        items: billData,
        subtotal: orderData.totalAmount,
        tax: 0, // 8% tax
        total: orderData.totalAmount,
      };

      const filePath = `${billsDirectory}/order-${generateRandomString()}.pdf`;
      const customerEmail = order.email;

      // Generate PDF and Send Email
      generateInvoicePDF(invoiceData, filePath)
        .then(() =>
          sendMail({
            filename: "Order Details.pdf",
            email: customerEmail,
            filePath: filePath,
          })
        )
        .catch((error) => console.error("Error:", error));

      return res.status(200).json({
        data: order,
        status: 201,
      });
    }
    // }
  } catch (error) {
    await session.abortTransaction(); // Abort transaction on error
    session.endSession(); // End session
    console.log(error);
    res.status(400).json({ error: error.message });
  }
};

const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required" });
    }

    let orderDetails = await fastfoodOrderModel
      .findOne({
        _id: orderId,
        payment_mode: {
          $in: [
            ORDER_PAYMENT_MODE.BOTH,
            ORDER_PAYMENT_MODE.WALLET,
            ORDER_PAYMENT_MODE.RAZORPAY,
          ],
        },
      })
      ?.populate("paymentIds");

    let orderDetailsStatus = orderDetails?.paymentIds?.every((value) => {
      return value.status === "completed";
    });
    console.log("orderDetailsStatus", orderDetailsStatus);
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

module.exports = { placeFastfoodOrder, getPaymentStatus };
