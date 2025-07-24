const mongoose = require("mongoose");
const {
  ORDER_STATUS,
  VESU_AREA_PINCODES,
  ORDER_PAYMENT_MODE,
  ORDER_TYPE,
  ORDER_STATUS_MESSAGE,
} = require("../utils/constants");

// Define the schema for an Order
const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Assuming you have a User model
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  items: [
    {
      category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category", // Assuming you have a Category model
        required: true,
      },
      category_title: { type: String, required: true },

      items: [
        {
          dish: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Dish", // Assuming you have a Dish model
            required: true,
          },
          title: {
            type: String,
            required: true,
          },
          imageUrl: {
            type: String,
            required: false,
          },
          quantity: {
            type: Number,
            required: true,
            min: 1,
          },
          mrp: {
            type: Number,
            required: true,
          },
          salePrice: {
            type: Number,
            required: true,
          },
          customizable: {
            type: Boolean,
            default: false,
          },
          diet: {
            type: String,
            required: true,
          },
          customizeCategories: [
            {
              _id: {
                type: String,
                required: true,
              },
              title: {
                type: String,
                required: true,
              },
              allowMultiple: {
                type: Boolean,
                required: true,
              },
              limit: {
                type: Number,
                required: true,
              },
              options: [
                {
                  _id: {
                    type: String,
                    required: true,
                  },
                  title: {
                    type: String,
                    required: true,
                  },
                  priceAddOn: {
                    type: Number,
                    required: true,
                  },
                },
              ],
            },
          ],
          quantity: {
            type: Number,
            required: true,
            min: 1,
          },
        },
      ],
    },
  ],
  totalAmount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: [...Object.values(ORDER_STATUS_MESSAGE)],
    default: ORDER_STATUS.PENDING,
  },
  isJain: {
    type: Boolean,
    default: false,
  },
  deliveryAddress: {
    line1: {
      type: String,
      required: true,
    },
    line2: {
      type: String,
      required: false,
    },
    city: {
      type: String,
      required: true,
    },
    pincode: {
      type: String,
      required: true,
    },
  },
  orderType: {
    type: String,
    enum: [...Object.values(ORDER_TYPE)],
    required: true,
  },
  thal_quantity: {
    type: Number,
    required: function () {
      return this.orderType === ORDER_TYPE.THAL;
    },
  },
  thal_price: {
    type: Number,
    required: function () {
      return this.orderType === ORDER_TYPE.THAL;
    },
  },
  deliveryDateTime: {
    type: Date,
    required: true,
  },
  payment_mode: {
    type: String,
    enum: [...Object.values(ORDER_PAYMENT_MODE)],
    required: true,
  },
  paymentIds: {
    type: [mongoose.Schema.Types.ObjectId], // Array of ObjectIds for 'both' payment mode
    ref: "Transaction",
    validate: {
      validator: function (value) {
        // If payment mode is 'both', it should be an array
        if (this.payment_mode === ORDER_PAYMENT_MODE.BOTH) {
          return Array.isArray(value) && value.length > 0;
        }
        // If payment mode is 'wallet' or 'paypal', it should be a single ObjectId
        return (
          this.payment_mode !== ORDER_PAYMENT_MODE.BOTH && value.length === 1
        );
      },
      message: (props) =>
        `Invalid paymentId(s) for payment mode: ${props.value}`,
    },
  },
  adminComments: {
    type: String,
    default: "",
  },
  userComments: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create the Order model
const OrderModel = mongoose.model("Order", orderSchema);

module.exports = OrderModel;
