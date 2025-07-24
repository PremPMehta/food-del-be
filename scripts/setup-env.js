/**
 * Environment Setup Script
 * Helps set up configuration for development without Razorpay keys
 */

const fs = require('fs');
const path = require('path');

const configExamplePath = path.join(__dirname, '../src/config/config.js.example');
const configPath = path.join(__dirname, '../src/config/config.js');

// Development configuration template
const devConfig = `const JWT_SECRET = "your_jwt_secret_key_here";

const SALT_ROUNDS = 10;

const MAIL_SERVICE_URL = "https://your-mail-service.com";

const BACKEND_URL = "http://localhost:8000";

const FRONTEND_URL = "http://localhost:3000";

const FRONTEND_PAYMENT_REDIRECT_URL = "http://localhost:3000";

const MAIL_SERVICE_TOKEN = "your_mail_service_token";

const PRIME_MEMBERSHIP_AMOUNT = 999;

const MONGO_URI = "mongodb://localhost:27017/food-delivery";

const CASHFREE_API_KEY = "";
const CASHFREE_SECRET = "";
const CASHFREE_API_ENDPOINT = "";

const PAYPAL_CLIENT_ID = "";
const PAYPAL_CLIENT_SECRET = "";
const PAYPAL_BASE_URL = "";
const PAYPAL_WEBHOOK_ID = "";

// Razorpay Configuration
// For Development (Mock Mode) - No real keys needed
const RAZORPAY_ID_KEY = "rzp_test_mock_key_for_development";
const RAZORPAY_SECRET_KEY = "mock_secret_key_for_development";
const WEBHOOK_SECRET = "mock_webhook_secret_for_development";
const RAZORPAY_SANDBOX_MODE = true;

// For Production (Live) - Uncomment and update when ready
// const RAZORPAY_ID_KEY = "rzp_live_YOUR_LIVE_KEY_ID";
// const RAZORPAY_SECRET_KEY = "YOUR_LIVE_SECRET_KEY";
// const WEBHOOK_SECRET = "YOUR_WEBHOOK_SECRET";
// const RAZORPAY_SANDBOX_MODE = false;

const LOCATION_KEY = "your_location_api_key";

module.exports = {
  BACKEND_URL,
  JWT_SECRET,
  MAIL_SERVICE_URL,
  MAIL_SERVICE_TOKEN,
  MONGO_URI,
  FRONTEND_URL,
  SALT_ROUNDS,
  CASHFREE_API_KEY,
  CASHFREE_SECRET,
  CASHFREE_API_ENDPOINT,
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_BASE_URL,
  PAYPAL_WEBHOOK_ID,
  PRIME_MEMBERSHIP_AMOUNT,
  FRONTEND_PAYMENT_REDIRECT_URL,
  RAZORPAY_ID_KEY,
  RAZORPAY_SECRET_KEY,
  WEBHOOK_SECRET,
  RAZORPAY_SANDBOX_MODE,
  LOCATION_KEY,
};
`;

// Production configuration template
const prodConfig = `const JWT_SECRET = process.env.JWT_SECRET || "your_production_jwt_secret";

const SALT_ROUNDS = 10;

const MAIL_SERVICE_URL = process.env.MAIL_SERVICE_URL || "";

const BACKEND_URL = process.env.BACKEND_URL || "https://your-production-domain.com";

const FRONTEND_URL = process.env.FRONTEND_URL || "https://your-frontend-domain.com";

const FRONTEND_PAYMENT_REDIRECT_URL = process.env.FRONTEND_PAYMENT_REDIRECT_URL || "https://your-frontend-domain.com";

const MAIL_SERVICE_TOKEN = process.env.MAIL_SERVICE_TOKEN || "";

const PRIME_MEMBERSHIP_AMOUNT = parseInt(process.env.PRIME_MEMBERSHIP_AMOUNT) || 999;

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/food-delivery";

const CASHFREE_API_KEY = process.env.CASHFREE_API_KEY || "";
const CASHFREE_SECRET = process.env.CASHFREE_SECRET || "";
const CASHFREE_API_ENDPOINT = process.env.CASHFREE_API_ENDPOINT || "";

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";
const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL || "";
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || "";

// Razorpay Configuration for Production
const RAZORPAY_ID_KEY = process.env.RAZORPAY_ID_KEY || "rzp_live_YOUR_LIVE_KEY_ID";
const RAZORPAY_SECRET_KEY = process.env.RAZORPAY_SECRET_KEY || "YOUR_LIVE_SECRET_KEY";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "YOUR_WEBHOOK_SECRET";
const RAZORPAY_SANDBOX_MODE = process.env.RAZORPAY_SANDBOX_MODE === "true" || false;

const LOCATION_KEY = process.env.LOCATION_KEY || "";

module.exports = {
  BACKEND_URL,
  JWT_SECRET,
  MAIL_SERVICE_URL,
  MAIL_SERVICE_TOKEN,
  MONGO_URI,
  FRONTEND_URL,
  SALT_ROUNDS,
  CASHFREE_API_KEY,
  CASHFREE_SECRET,
  CASHFREE_API_ENDPOINT,
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_BASE_URL,
  PAYPAL_WEBHOOK_ID,
  PRIME_MEMBERSHIP_AMOUNT,
  FRONTEND_PAYMENT_REDIRECT_URL,
  RAZORPAY_ID_KEY,
  RAZORPAY_SECRET_KEY,
  WEBHOOK_SECRET,
  RAZORPAY_SANDBOX_MODE,
  LOCATION_KEY,
};
`;

/**
 * Create development configuration
 */
const setupDevConfig = () => {
  try {
    if (fs.existsSync(configPath)) {
      console.log('⚠️  Config file already exists. Backing up...');
      const backupPath = configPath + '.backup.' + Date.now();
      fs.copyFileSync(configPath, backupPath);
      console.log('✅ Backup created:', backupPath);
    }

    fs.writeFileSync(configPath, devConfig);
    console.log('✅ Development configuration created successfully!');
    console.log('📁 Config file location:', configPath);
    console.log('\n🔧 Next steps:');
    console.log('1. Update the configuration values as needed');
    console.log('2. Start your server: npm run dev');
    console.log('3. Test payments using mock endpoints');
    console.log('4. Run tests: node scripts/test-payments.js');
  } catch (error) {
    console.error('❌ Error creating development config:', error.message);
  }
};

/**
 * Create production configuration
 */
const setupProdConfig = () => {
  try {
    if (fs.existsSync(configPath)) {
      console.log('⚠️  Config file already exists. Backing up...');
      const backupPath = configPath + '.backup.' + Date.now();
      fs.copyFileSync(configPath, backupPath);
      console.log('✅ Backup created:', backupPath);
    }

    fs.writeFileSync(configPath, prodConfig);
    console.log('✅ Production configuration created successfully!');
    console.log('📁 Config file location:', configPath);
    console.log('\n🔧 Next steps:');
    console.log('1. Set up environment variables');
    console.log('2. Update Razorpay live keys');
    console.log('3. Configure webhook URLs');
    console.log('4. Test with small amounts first');
  } catch (error) {
    console.error('❌ Error creating production config:', error.message);
  }
};

/**
 * Show current configuration status
 */
const showStatus = () => {
  console.log('📋 Configuration Status');
  console.log('======================');
  
  if (fs.existsSync(configPath)) {
    console.log('✅ Config file exists:', configPath);
    
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    if (configContent.includes('mock_key_for_development')) {
      console.log('🔧 Mode: Development (Mock)');
      console.log('💡 You can test payments without real Razorpay keys');
    } else if (configContent.includes('rzp_live_')) {
      console.log('🚀 Mode: Production (Live)');
      console.log('⚠️  Make sure you have real Razorpay keys configured');
    } else {
      console.log('❓ Mode: Unknown');
      console.log('💡 Run setup-dev or setup-prod to configure');
    }
  } else {
    console.log('❌ Config file does not exist');
    console.log('💡 Run setup-dev or setup-prod to create configuration');
  }
  
  console.log('\n📚 Available commands:');
  console.log('  node scripts/setup-env.js dev     - Setup development config');
  console.log('  node scripts/setup-env.js prod    - Setup production config');
  console.log('  node scripts/setup-env.js status  - Show current status');
};

/**
 * Main function
 */
const main = () => {
  const command = process.argv[2];
  
  console.log('🔧 Environment Setup Script');
  console.log('==========================\n');
  
  switch (command) {
    case 'dev':
      setupDevConfig();
      break;
    case 'prod':
      setupProdConfig();
      break;
    case 'status':
      showStatus();
      break;
    default:
      console.log('❌ Invalid command. Available commands:');
      console.log('  dev    - Setup development configuration');
      console.log('  prod   - Setup production configuration');
      console.log('  status - Show current configuration status');
      console.log('\n💡 Example: node scripts/setup-env.js dev');
  }
};

// Run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  setupDevConfig,
  setupProdConfig,
  showStatus
}; 