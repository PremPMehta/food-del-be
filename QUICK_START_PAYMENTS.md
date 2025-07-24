# 🚀 Quick Start: Payment Testing Without Razorpay Keys

This guide helps you test payment functionality immediately without waiting for Razorpay API keys.

## ⚡ Quick Setup (5 minutes)

### 1. **Setup Development Environment**
```bash
# Create development configuration
npm run setup-dev

# Check configuration status
npm run config-status
```

### 2. **Start the Server**
```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

### 3. **Test Payment Endpoints**

#### **Get Testing Instructions**
```bash
curl http://localhost:8000/api/v1/users/payment-test/mock/instructions
```

#### **Create Wallet Top-up Payment**
```bash
curl -X POST http://localhost:8000/api/v1/users/payment-test/mock/wallet-topup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"amount": 500}'
```

#### **Simulate Payment Success**
```bash
curl -X POST http://localhost:8000/api/v1/users/payment-test/mock/simulate-success \
  -H "Content-Type: application/json" \
  -d '{"payment_id": "plink_mock_xxxxx"}'
```

## 🧪 Automated Testing

### **Run All Payment Tests**
```bash
# Update TEST_USER_TOKEN in scripts/test-payments.js first
npm run test-payments
```

### **Run Individual Tests**
```bash
# Test wallet top-up only
npm run test-payments:wallet

# Test prime membership only
npm run test-payments:prime

# Test order payment only
npm run test-payments:order
```

## 📋 Available Mock Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/payment-test/mock/instructions` | GET | Get testing instructions |
| `/payment-test/mock/wallet-topup` | POST | Create wallet top-up payment |
| `/payment-test/mock/prime-membership` | POST | Create prime membership payment |
| `/payment-test/mock/order-payment` | POST | Create order payment |
| `/payment-test/mock/simulate-success` | POST | Simulate payment success |
| `/payment-test/mock/simulate-failure` | POST | Simulate payment failure |
| `/payment-test/mock/payment/:id` | GET | Get payment details |
| `/payment-test/mock/webhook` | POST | Test webhook processing |

## 🔄 Testing Flow

1. **Create Payment** → Get payment ID
2. **Simulate Success/Failure** → Process payment
3. **Check Database** → Verify updates
4. **Test Webhook** → Verify webhook processing

## 📊 What Gets Tested

### **Database Updates**
- ✅ Payment records created
- ✅ Transaction records created
- ✅ User wallet balance updated
- ✅ Order status updated
- ✅ Prime membership status updated

### **API Responses**
- ✅ Payment link generation
- ✅ Payment status tracking
- ✅ Error handling
- ✅ Webhook processing

### **Business Logic**
- ✅ Wallet top-up processing
- ✅ Prime membership activation
- ✅ Order payment processing
- ✅ Referral rewards (if applicable)

## 🛠️ Manual Testing with Postman/Insomnia

### **1. Create Wallet Top-up**
```
POST http://localhost:8000/api/v1/users/payment-test/mock/wallet-topup
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
  Content-Type: application/json

Body:
{
  "amount": 500
}
```

### **2. Simulate Payment Success**
```
POST http://localhost:8000/api/v1/users/payment-test/mock/simulate-success
Headers:
  Content-Type: application/json

Body:
{
  "payment_id": "plink_mock_xxxxx"
}
```

### **3. Check Payment Status**
```
GET http://localhost:8000/api/v1/users/payment-test/mock/payment/plink_mock_xxxxx
```

## 🔧 Configuration

### **Development Mode**
- Uses mock Razorpay service
- No real API keys required
- Simulates all payment responses
- Perfect for development and testing

### **Production Mode**
- Uses real Razorpay API
- Requires actual API keys
- Real payment processing
- For live deployment

## 📝 Next Steps

1. **Test all endpoints** using the mock service
2. **Verify database updates** after each test
3. **Get Razorpay keys** when ready for production
4. **Switch to production mode** using `npm run setup-prod`
5. **Update configuration** with real API keys
6. **Test with real payments** using small amounts

## 🆘 Troubleshooting

### **Server Won't Start**
```bash
# Check if config file exists
npm run config-status

# Recreate config if needed
npm run setup-dev
```

### **Tests Fail**
```bash
# Check server is running
curl http://localhost:8000/api/v1/users/payment-test/mock/instructions

# Update JWT token in test script
# Edit scripts/test-payments.js and update TEST_USER_TOKEN
```

### **Database Issues**
```bash
# Check MongoDB connection
# Verify MONGO_URI in config file
# Ensure MongoDB is running
```

## 📚 Additional Resources

- [Razorpay Integration Guide](./RAZORPAY_INTEGRATION.md)
- [API Documentation](./swagger.json)
- [Payment Testing Scripts](./scripts/test-payments.js)

---

**🎉 You're all set! Start testing payments immediately without waiting for Razorpay keys.** 