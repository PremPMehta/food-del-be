const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../utils/constants');

const paymentSchema = new mongoose.Schema({
    order_id : { type: String , required: true , unique: true , index: true },
    user_id : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    description : { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: [PAYMENT_STATUS.COMPLETED , PAYMENT_STATUS.PENDING , PAYMENT_STATUS.FAILED ], default: 'pending' },
    payment_confirmed_at : { type: Date, default: null },
} , { timestamps: true });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;