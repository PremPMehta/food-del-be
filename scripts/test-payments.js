/**
 * Payment Testing Scripts
 * Run these scripts to test payment functionality without Razorpay keys
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:8888/api/v1/users';
const TEST_USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2ODgyMWExMGM0Nzg2OTUxOGY3NjFmYzgiLCJuYW1lIjoiVGVzdCBVc2VyIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicGhvbmUiOiIxMjM0NTY3ODkwIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NTMzNTY4MTYsImV4cCI6MTc1MzQ0MzIxNn0.ZRW81BrFg8Peodnp7C27MMsswQ4W24Dt9FAAhpf15-U';

// Test data
const testData = {
  walletTopUp: {
    amount: 500
  },
  orderPayment: {
    amount: 250,
    orderId: 'test_order_123',
    orderType: 'thal'
  }
};

// Helper function to make authenticated requests
const makeRequest = async (method, endpoint, data = null, token = TEST_USER_TOKEN) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error in ${method} ${endpoint}:`, error.response?.data || error.message);
    return null;
  }
};

// Test 1: Get testing instructions
const testInstructions = async () => {
  console.log('\n🧪 Test 1: Getting Testing Instructions');
  console.log('=====================================');
  
  const result = await makeRequest('GET', '/payment-test/mock/instructions', null, null);
  
  if (result) {
    console.log('✅ Instructions retrieved successfully');
    console.log('Available endpoints:', Object.keys(result.data.endpoints));
    console.log('Testing flow:', result.data.testing_flow);
  } else {
    console.log('❌ Failed to get instructions');
  }
};

// Test 2: Create wallet top-up payment
const testWalletTopUp = async () => {
  console.log('\n💰 Test 2: Creating Wallet Top-up Payment');
  console.log('========================================');
  
  const result = await makeRequest('POST', '/payment-test/mock/wallet-topup', testData.walletTopUp);
  
  if (result && result.success) {
    console.log('✅ Wallet top-up payment created successfully');
    console.log('Payment ID:', result.data.payment_id);
    console.log('Amount:', result.data.amount);
    return result.data.payment_id;
  } else {
    console.log('❌ Failed to create wallet top-up payment');
    return null;
  }
};

// Test 3: Create prime membership payment
const testPrimeMembership = async () => {
  console.log('\n👑 Test 3: Creating Prime Membership Payment');
  console.log('===========================================');
  
  const result = await makeRequest('POST', '/payment-test/mock/prime-membership');
  
  if (result && result.success) {
    console.log('✅ Prime membership payment created successfully');
    console.log('Payment ID:', result.data.payment_id);
    console.log('Amount:', result.data.amount);
    return result.data.payment_id;
  } else {
    console.log('❌ Failed to create prime membership payment');
    return null;
  }
};

// Test 4: Create order payment
const testOrderPayment = async () => {
  console.log('\n🍽️ Test 4: Creating Order Payment');
  console.log('================================');
  
  const result = await makeRequest('POST', '/payment-test/mock/order-payment', testData.orderPayment);
  
  if (result && result.success) {
    console.log('✅ Order payment created successfully');
    console.log('Payment ID:', result.data.payment_id);
    console.log('Amount:', result.data.amount);
    console.log('Order ID:', result.data.order_id);
    return result.data.payment_id;
  } else {
    console.log('❌ Failed to create order payment');
    return null;
  }
};

// Test 5: Simulate payment success
const testPaymentSuccess = async (paymentId) => {
  console.log('\n✅ Test 5: Simulating Payment Success');
  console.log('===================================');
  
  const result = await makeRequest('POST', '/payment-test/mock/simulate-success', { payment_id: paymentId }, null);
  
  if (result && result.success) {
    console.log('✅ Payment success simulated successfully');
    console.log('Payment ID:', result.data.payment_id);
    console.log('Status:', result.data.status);
    console.log('Amount:', result.data.amount);
  } else {
    console.log('❌ Failed to simulate payment success');
  }
};

// Test 6: Simulate payment failure
const testPaymentFailure = async (paymentId) => {
  console.log('\n❌ Test 6: Simulating Payment Failure');
  console.log('===================================');
  
  const result = await makeRequest('POST', '/payment-test/mock/simulate-failure', { payment_id: paymentId }, null);
  
  if (result) {
    console.log('✅ Payment failure simulated successfully');
    console.log('Payment ID:', result.data.payment_id);
    console.log('Status:', result.data.status);
    console.log('Error:', result.data.error);
  } else {
    console.log('❌ Failed to simulate payment failure');
  }
};

// Test 7: Get payment details
const testGetPaymentDetails = async (paymentId) => {
  console.log('\n📋 Test 7: Getting Payment Details');
  console.log('=================================');
  
  const result = await makeRequest('GET', `/payment-test/mock/payment/${paymentId}`, null, null);
  
  if (result && result.success) {
    console.log('✅ Payment details retrieved successfully');
    console.log('Payment ID:', result.data.payment.id);
    console.log('Status:', result.data.payment.status);
    console.log('Amount:', result.data.payment.amount);
    console.log('Currency:', result.data.payment.currency);
  } else {
    console.log('❌ Failed to get payment details');
  }
};

// Test 8: Test webhook
const testWebhook = async (paymentId) => {
  console.log('\n🔗 Test 8: Testing Webhook');
  console.log('=========================');
  
  const webhookData = {
    event: 'payment.success',
    payment_id: paymentId,
    status: 'success'
  };
  
  const result = await makeRequest('POST', '/payment-test/mock/webhook', webhookData, null);
  
  if (result && result.success) {
    console.log('✅ Webhook processed successfully');
    console.log('Message:', result.message);
    console.log('Data:', result.data);
  } else {
    console.log('❌ Failed to process webhook');
  }
};

// Main test runner
const runAllTests = async () => {
  console.log('🚀 Starting Payment Testing Suite');
  console.log('================================');
  console.log('Base URL:', BASE_URL);
  console.log('Note: Make sure your server is running and update TEST_USER_TOKEN');
  
  // Test 1: Get instructions
  await testInstructions();
  
  // Test 2: Create wallet top-up payment
  const walletPaymentId = await testWalletTopUp();
  
  // Test 3: Create prime membership payment
  const primePaymentId = await testPrimeMembership();
  
  // Test 4: Create order payment
  const orderPaymentId = await testOrderPayment();
  
  // Test 5: Simulate success for wallet payment
  if (walletPaymentId) {
    await testPaymentSuccess(walletPaymentId);
    await testGetPaymentDetails(walletPaymentId);
  }
  
  // Test 6: Simulate failure for prime payment
  if (primePaymentId) {
    await testPaymentFailure(primePaymentId);
    await testGetPaymentDetails(primePaymentId);
  }
  
  // Test 7: Test webhook for order payment
  if (orderPaymentId) {
    await testWebhook(orderPaymentId);
  }
  
  console.log('\n🎉 Payment Testing Suite Completed!');
  console.log('===================================');
  console.log('Check your database to verify the results:');
  console.log('- Payment records in payments collection');
  console.log('- Transaction records in transactions collection');
  console.log('- User wallet balance updates');
  console.log('- Order status updates');
};

// Individual test runners
const runWalletTest = async () => {
  console.log('💰 Running Wallet Top-up Test');
  const paymentId = await testWalletTopUp();
  if (paymentId) {
    await testPaymentSuccess(paymentId);
    await testGetPaymentDetails(paymentId);
  }
};

const runPrimeTest = async () => {
  console.log('👑 Running Prime Membership Test');
  const paymentId = await testPrimeMembership();
  if (paymentId) {
    await testPaymentSuccess(paymentId);
    await testGetPaymentDetails(paymentId);
  }
};

const runOrderTest = async () => {
  console.log('🍽️ Running Order Payment Test');
  const paymentId = await testOrderPayment();
  if (paymentId) {
    await testPaymentSuccess(paymentId);
    await testGetPaymentDetails(paymentId);
  }
};

// Export functions for use in other scripts
module.exports = {
  runAllTests,
  runWalletTest,
  runPrimeTest,
  runOrderTest,
  testWalletTopUp,
  testPrimeMembership,
  testOrderPayment,
  testPaymentSuccess,
  testPaymentFailure,
  testGetPaymentDetails,
  testWebhook,
  makeRequest
};

// Run tests if this file is executed directly
if (require.main === module) {
  const testType = process.argv[2];
  
  switch (testType) {
    case 'wallet':
      runWalletTest();
      break;
    case 'prime':
      runPrimeTest();
      break;
    case 'order':
      runOrderTest();
      break;
    default:
      runAllTests();
  }
} 