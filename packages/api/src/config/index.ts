// ============================================
// BeeCastly API Configuration
// ============================================

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001'),
  host: process.env.HOST || '0.0.0.0',
  apiUrl: process.env.API_URL || 'http://localhost:3001',

  // Frontend
  webUrl: process.env.WEB_URL || 'http://localhost:3000',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],

  // Security
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'beecastly',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  },

  // Twilio (Voice & SMS)
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    voiceUrl: process.env.TWILIO_VOICE_URL || '',
    statusCallbackUrl: process.env.TWILIO_STATUS_CALLBACK_URL || '',
  },

  // WhatsApp Cloud API
  whatsapp: {
    enabled: process.env.WHATSAPP_ENABLED === 'true',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v18.0',
  },

  // Evolution API (WhatsApp alternative)
  evolutionApi: {
    enabled: process.env.EVOLUTION_API_ENABLED === 'true',
    endpoint: process.env.EVOLUTION_API_ENDPOINT || '',
    apiKey: process.env.EVOLUTION_API_KEY || '',
    instanceName: process.env.EVOLUTION_API_INSTANCE_NAME || 'beecastly',
  },

  // SMS Providers
  sms: {
    defaultProvider: process.env.SMS_DEFAULT_PROVIDER || 'twilio',
    msg91: {
      authKey: process.env.MSG91_AUTH_KEY || '',
      senderId: process.env.MSG91_SENDER_ID || '',
    },
    fast2sms: {
      apiKey: process.env.FAST2SMS_API_KEY || '',
      senderId: process.env.FAST2SMS_SENDER_ID || '',
    },
    awsSns: {
      accessKeyId: process.env.AWS_SNS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SNS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_SNS_REGION || 'us-east-1',
    },
  },

  // Email
  email: {
    defaultProvider: process.env.EMAIL_DEFAULT_PROVIDER || 'smtp',
    from: process.env.EMAIL_FROM || 'noreply@beecastly.com',
    fromName: process.env.EMAIL_FROM_NAME || 'BeeCastly',
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      password: process.env.SMTP_PASSWORD || '',
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY || '',
    },
    mailgun: {
      apiKey: process.env.MAILGUN_API_KEY || '',
      domain: process.env.MAILGUN_DOMAIN || '',
    },
  },

  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || '',
  },

  // Stripe
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },

  // Razorpay
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  // Storage
  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    local: {
      uploadDir: process.env.LOCAL_UPLOAD_DIR || './uploads',
    },
    s3: {
      bucket: process.env.S3_BUCKET || '',
      region: process.env.S3_REGION || '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
  },

  // Queue
  queue: {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
    concurrency: {
      messages: 10,
      workflows: 5,
      voice: 3,
      analytics: 20,
      exports: 2,
      imports: 1,
      ai: 5,
    },
  },

  // Rate Limiting
  rateLimit: {
    auth: {
      login: { limit: 5, window: 300 },
      register: { limit: 3, window: 3600 },
      forgotPassword: { limit: 3, window: 3600 },
    },
    api: {
      default: { limit: 1000, window: 3600 },
      public: { limit: 100, window: 3600 },
      webhook: { limit: 10000, window: 3600 },
    },
  },

  // AI Configuration
  ai: {
    leadQualification: {
      enabled: true,
      minConfidence: 0.7,
      autoQualify: true,
    },
    conversation: {
      enabled: true,
      handoffThreshold: 0.3,
      maxResponseTime: 5000,
      contextWindow: 10,
    },
    voice: {
      enabled: true,
      defaultVoice: 'alloy',
      maxDuration: 600,
    },
    leadScoring: {
      enabled: true,
      behaviorWeight: 0.4,
      engagementWeight: 0.35,
      demographicWeight: 0.25,
    },
  },

  // Anti-Spam
  antiSpam: {
    enabled: true,
    reputationThreshold: 50,
    autoPauseThreshold: 30,
    warmupMode: true,
    maxMessagesPerHour: 100,
    minIntervalSeconds: 5,
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logFormat: process.env.LOG_FORMAT || 'json',
} as const;

// Validate required configuration
export function validateConfig(): void {
  const required = [
    'jwtSecret',
    'database.host',
    'database.name',
    'database.user',
    'database.password',
    'redis.host',
  ];

  const missing: string[] = [];

  for (const key of required) {
    const value = key.split('.').reduce((obj, k) => obj?.[k], config as any);
    if (!value || value === 'your-super-secret-jwt-key-change-in-production') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.warn('⚠️  Missing or default configuration values:', missing.join(', '));
    console.warn('Some features may not work correctly.');
  }
}

validateConfig();
