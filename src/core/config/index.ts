import dotenv from "dotenv";

// Load environment variables
const result = dotenv.config();

// Handle .env loading errors
if (result.error) {
  if (result.error.message.includes("ENOENT")) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        "⚠️  .env file not found. Please create one based on .env.example",
      );
    } else {
      console.warn(
        "⚠️  .env file not found. Using provided environment variables.",
      );
    }
  } else {
    throw new Error(`Failed to load .env file: ${result.error.message}`);
  }
}

// Validate and parse configuration
export const config = {
  server: {
    port: parseInt(process.env.PORT || "3030"),
    env: process.env.NODE_ENV,
    isProduction: process.env.NODE_ENV === "production",
    isDevelopment: process.env.NODE_ENV === "development",
    isTest: process.env.NODE_ENV === "test",
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || "30000"),
  },
  database: {
    url: process.env.DATABASE_URL,
    logging: process.env.DB_LOGGING === "true",
  },
  security: {
    cors: {
      allowedOrigins: process.env.ALLOWED_ORIGINS || "http://localhost:3000",
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"),
      max: parseInt(process.env.RATE_LIMIT_MAX || "100"),
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      issuer: process.env.JWT_ISSUER || "ignitor-app",
    },
  },
  defaultAdmin: {
    email: process.env.DEFAULT_ADMIN_EMAIL,
    password: process.env.DEFAULT_ADMIN_PASSWORD,
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER || 'uploads',
  },
  s3: {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    folder: process.env.S3_FOLDER || 'uploads/',
    endpoint: process.env.S3_ENDPOINT,
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT,
  },
  fileUploader: process.env.FILE_UPLOADER || 'cloudinary',
  logging: {
    level: process.env.LOG_LEVEL || "info",
    path: process.env.LOG_FILE_PATH || "logs/app.log",
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY,
  },
  flutterwave: {
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
    webhookSecret: process.env.FLUTTERWAVE_WEBHOOK_SECRET,
  },
  payout: {
    enabled: process.env.PAYOUT_ENABLED !== 'false',
    delayHours: parseInt(process.env.PAYOUT_DELAY_HOURS || '0'),
  },
  pesapal: {
    consumerKey: process.env.PESAPAL_CONSUMER_KEY,
    consumerSecret: process.env.PESAPAL_CONSUMER_SECRET,
    ipnId: process.env.PESAPAL_IPN_ID,
    sandbox: process.env.PESAPAL_SANDBOX !== "false",
    // Keep this disabled until the webhook and end-to-end sandbox test are complete.
    enabledCountries: (process.env.PESAPAL_ENABLED_COUNTRIES || "")
      .split(",")
      .map((country) => country.trim().toUpperCase())
      .filter(Boolean),
  },
  clientUrl: process.env.CLIENT_URL || (process.env.NODE_ENV === "production" ? "https://upbeat.africa" : "http://localhost:3000"),
  apiUrl: process.env.API_URL || (process.env.NODE_ENV === "production" ? "https://api.upbeat.africa" : `http://localhost:${process.env.PORT || 3030}`),
  smtp: {
    host: process.env.SMTP_HOST || "sandbox.smtp.mailtrap.io",
    port: parseInt(process.env.SMTP_PORT || "2525"),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || "noreply@upbeatafrica.com",
  },
};

export default config;

// Production Key Validation
if (config.server.isProduction) {
  const missingKeys = [];
  if (!config.paystack.secretKey) missingKeys.push('PAYSTACK_SECRET_KEY');
  if (!config.flutterwave.secretKey) missingKeys.push('FLUTTERWAVE_SECRET_KEY');
  if (!config.pesapal.consumerKey || !config.pesapal.consumerSecret) missingKeys.push('PESAPAL_CONSUMER_KEY/SECRET');

  if (missingKeys.length > 0) {
    console.error(`\x1b[31m[CRITICAL WARNING] Missing payment gateway keys in production: ${missingKeys.join(', ')}. Payments via these gateways will fail.\x1b[0m`);
  }
}
