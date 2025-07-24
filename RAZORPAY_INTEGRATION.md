# Razorpay Sandbox Integration Guide

This document provides a comprehensive guide for integrating Razorpay sandbox payment gateway into the food delivery application.

## Table of Contents

1. [Overview](#overview)
2. [Setup Instructions](#setup-instructions)
3. [API Endpoints](#api-endpoints)
4. [Test Cards](#test-cards)
5. [Webhook Configuration](#webhook-configuration)
6. [Testing Guide](#testing-guide)
7. [Error Handling](#error-handling)
8. [Production Deployment](#production-deployment)

## Overview

The Razorpay integration supports three main payment types:
- **Wallet Top-up**: Users can add money to their wallet
- **Prime Membership**: Users can purchase premium membership
- **Order Payment**: Users can pay for food orders

## Setup Instructions

### 1. Razorpay Account Setup

1. Create a Razorpay account at [https://razorpay.com](https://razorpay.com)
2. Navigate to Settings → API Keys
3. Generate test API keys for sandbox testing
4. Note down your Key ID and Key Secret

### 2. Environment Configuration

Copy the example configuration file and update it with your Razorpay credentials:

```bash
cp src/config/config.js.example src/config/config.js
```

Update the following variables in `src/config/config.js`:

```javascript
// For Sandbox Testing
const RAZORPAY_ID_KEY = "rzp_test_YOUR_TEST_KEY_ID";
const RAZORPAY_SECRET_KEY = "YOUR_TEST_SECRET_KEY";
const WEBHOOK_SECRET = "YOUR_WEBHOOK_SECRET";
const RAZORPAY_SANDBOX_MODE = true;

// Frontend redirect URL
const FRONTEND_PAYMENT_REDIRECT_URL = "http://localhost:3000";
```

### 3. Webhook Setup

1. In your Razorpay dashboard, go to Settings → Webhooks
2. Add a new webhook with the following URL:
   ```
   https://your-domain.com/api/v1/users/payment/razorpay-webhook
   ```
3. Select the following events:
   - `payment_link.paid`
   - `payment_link.expired`
4. Copy the webhook secret and update it in your config

## API Endpoints

### 1. Create Wallet Top-up Payment

**Endpoint:** `POST /api/v1/users/payment/wallet-topup`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "amount": 500
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment link created successfully",
  "data": {
    "payment_link": "https://rzp.io/i/xxxxx",
    "payment_id": "plink_xxxxx",
    "amount": 500
  }
}
```

### 2. Create Prime Membership Payment

**Endpoint:** `POST /api/v1/users/payment/prime-membership`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:** (No body required)

**Response:**
```json
{
  "success": true,
  "message": "Prime membership payment link created successfully",
  "data": {
    "payment_link": "https://rzp.io/i/xxxxx",
    "payment_id": "plink_xxxxx",
    "amount": 999
  }
}
```

### 3. Create Order Payment

**Endpoint:** `POST /api/v1/users/payment/order-payment`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "amount": 250,
  "orderId": "order_123",
  "orderType": "thal"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order payment link created successfully",
  "data": {
    "payment_link": "https://rzp.io/i/xxxxx",
    "payment_id": "plink_xxxxx",
    "amount": 250,
    "order_id": "order_123"
  }
}
```

### 4. Verify Payment Manually

**Endpoint:** `POST /api/v1/users/payment/verify-razorpay`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "razorpay_payment_id": "pay_xxxxx",
  "razorpay_order_id": "order_xxxxx",
  "razorpay_signature": "signature_xxxxx"
}
```

### 5. Get Payment Status

**Endpoint:** `GET /api/v1/users/payment/status/:payment_id`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment_id": "plink_xxxxx",
    "status": "completed",
    "amount": 500,
    "description": "Wallet top-up of ₹500",
    "created_at": "2024-01-01T00:00:00.000Z",
    "confirmed_at": "2024-01-01T00:05:00.000Z"
  }
}
```

### 6. Get Test Cards

**Endpoint:** `GET /api/v1/users/payment/test-cards`

**Response:**
```json
{
  "success": true,
  "message": "Test card details retrieved successfully",
  "data": {
    "cards": {
      "success": {
        "number": "4111 1111 1111 1111",
        "cvv": "123",
        "expiry": "12/25",
        "name": "Test User"
      },
      "failure": {
        "number": "4000 0000 0000 0002",
        "cvv": "123",
        "expiry": "12/25",
        "name": "Test User"
      }
    },
    "upi": {
      "success": "success@razorpay",
      "failure": "failure@razorpay"
    }
  }
}
```

### 7. Refund Payment

**Endpoint:** `POST /api/v1/users/payment/refund`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "payment_id": "plink_xxxxx",
  "reason": "Customer requested refund"
}
```

## Test Cards

### Credit/Debit Cards

| Card Type | Card Number | CVV | Expiry | Expected Result |
|-----------|-------------|-----|--------|-----------------|
| Success | 4111 1111 1111 1111 | 123 | 12/25 | Payment successful |
| Failure | 4000 0000 0000 0002 | 123 | 12/25 | Payment failed |
| Insufficient Funds | 4000 0000 0000 9995 | 123 | 12/25 | Payment failed |

### UPI

| UPI ID | Expected Result |
|--------|-----------------|
| success@razorpay | Payment successful |
| failure@razorpay | Payment failed |

### Net Banking

| Bank Code | Expected Result |
|-----------|-----------------|
| SBIN | Payment successful |

## Webhook Configuration

The webhook endpoint automatically processes payment events:

- **payment_link.paid**: Updates payment status to completed and processes the transaction
- **payment_link.expired**: Updates payment status to failed

### Webhook Events

```json
{
  "event": "payment_link.paid",
  "payload": {
    "payment_link": {
      "entity": {
        "id": "plink_xxxxx",
        "order_id": "order_xxxxx",
        "amount_paid": 50000
      }
    }
  }
}
```

## Testing Guide

### 1. Test Wallet Top-up

1. Call the wallet top-up endpoint
2. Use the returned payment link
3. Complete payment with test card
4. Verify webhook processes the payment
5. Check user wallet balance is updated

### 2. Test Prime Membership

1. Call the prime membership endpoint
2. Complete payment with test card
3. Verify user becomes prime member
4. Check referral rewards if applicable

### 3. Test Order Payment

1. Create an order
2. Call the order payment endpoint
3. Complete payment with test card
4. Verify order status is updated

### 4. Test Payment Verification

1. Complete a payment
2. Use the verification endpoint with payment details
3. Verify payment is captured successfully

## Error Handling

### Common Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| 400 | Invalid amount | Check amount is greater than 0 |
| 400 | Payment verification failed | Verify signature and payment details |
| 404 | Payment not found | Check payment ID is correct |
| 500 | Internal server error | Check server logs |

### Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## Production Deployment

### 1. Update Configuration

Change the configuration to use live keys:

```javascript
const RAZORPAY_ID_KEY = "rzp_live_YOUR_LIVE_KEY_ID";
const RAZORPAY_SECRET_KEY = "YOUR_LIVE_SECRET_KEY";
const RAZORPAY_SANDBOX_MODE = false;
```

### 2. Update Webhook URL

Update the webhook URL to your production domain:

```
https://your-production-domain.com/api/v1/users/payment/razorpay-webhook
```

### 3. Security Considerations

- Never commit API keys to version control
- Use environment variables for sensitive data
- Enable HTTPS in production
- Implement rate limiting
- Monitor webhook events

### 4. Testing in Production

- Use small amounts for initial testing
- Monitor payment logs
- Test refund functionality
- Verify webhook processing

## Support

For issues related to:
- **Razorpay API**: Contact Razorpay support
- **Integration**: Check this documentation
- **Application**: Check application logs

## Additional Resources

- [Razorpay Documentation](https://razorpay.com/docs/)
- [Razorpay Test Cards](https://razorpay.com/docs/payments/payments/test-mode/test-cards/)
- [Webhook Events](https://razorpay.com/docs/webhooks/) 