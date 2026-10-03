import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
const jwtSecret = process.env.JWT_SECRET || (!isProduction ? 'thepurple_default_dev_jwt_secret_change_me' : '');
const databasePassword =
  process.env.DB_PASSWORD || (!isProduction && !isTest ? 'thepurple_secret_password' : '');
const frontendUrl = process.env.FRONTEND_URL || (!isProduction ? 'http://localhost:3000' : '');
const meilisearchMasterKey =
  process.env.MEILISEARCH_MASTER_KEY ||
  (!isProduction && !isTest ? 'thepurple_master_key_123456789' : '');
const redisPassword = process.env.REDIS_PASSWORD_FILE
  ? readFileSync(process.env.REDIS_PASSWORD_FILE, 'utf8').trim()
  : process.env.REDIS_PASSWORD || '';
const adminInitialEmail =
  process.env.ADMIN_INITIAL_EMAIL || (!isProduction && !isTest ? 'superadmin@gmail.com' : '');
const adminInitialPassword =
  process.env.ADMIN_INITIAL_PASSWORD || (!isProduction && !isTest ? '123456' : '');

if (isProduction) {
  const missingOrWeakSecrets = [];
  const isPlaceholder = (value) => /placeholder|replace|change.?me|example|your.?/i.test(value);
  let databaseUrlPassword = '';

  if (process.env.DATABASE_URL) {
    try {
      databaseUrlPassword = decodeURIComponent(new URL(process.env.DATABASE_URL).password);
    } catch {
      missingOrWeakSecrets.push('DATABASE_URL (valid PostgreSQL connection URL)');
    }
  }

  if (
    (process.env.DATABASE_URL ? databaseUrlPassword : databasePassword).length < 24 ||
    isPlaceholder(process.env.DATABASE_URL ? databaseUrlPassword : databasePassword)
  ) {
    missingOrWeakSecrets.push('database password (at least 24 random characters)');
  }
  if (jwtSecret.length < 32 || isPlaceholder(jwtSecret)) {
    missingOrWeakSecrets.push('JWT_SECRET (at least 32 random characters)');
  }
  if (meilisearchMasterKey.length < 32 || isPlaceholder(meilisearchMasterKey)) {
    missingOrWeakSecrets.push('MEILISEARCH_MASTER_KEY (at least 32 characters)');
  }
  if (!adminInitialEmail || isPlaceholder(adminInitialEmail)) {
    missingOrWeakSecrets.push('ADMIN_INITIAL_EMAIL');
  }
  if (adminInitialPassword && (adminInitialPassword.length < 12 || isPlaceholder(adminInitialPassword))) {
    missingOrWeakSecrets.push('ADMIN_INITIAL_PASSWORD (at least 12 characters)');
  }
  if (!frontendUrl.startsWith('https://') || isPlaceholder(frontendUrl)) {
    missingOrWeakSecrets.push('FRONTEND_URL (public HTTPS frontend origin)');
  }
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASSWORD ||
    isPlaceholder(process.env.SMTP_HOST) ||
    isPlaceholder(process.env.SMTP_USER) ||
    isPlaceholder(process.env.SMTP_PASSWORD)
  ) {
    missingOrWeakSecrets.push('SMTP_HOST, SMTP_USER, and SMTP_PASSWORD');
  }
  if (!/^[a-fA-F0-9]{48,}$/.test(redisPassword)) {
    missingOrWeakSecrets.push('REDIS_PASSWORD (at least 24 random bytes encoded as hex)');
  }

  if (missingOrWeakSecrets.length) {
    throw new Error(`Invalid production configuration: ${missingOrWeakSecrets.join(', ')}`);
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  FRONTEND_URL: frontendUrl,

  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_NAME: process.env.DB_NAME || 'thepurple_db',
  DB_USER: process.env.DB_USER || 'thepurple_user',
  DB_PASSWORD: databasePassword,
  DB_DIALECT: process.env.DB_DIALECT || 'postgres',
  DB_LOGGING: process.env.DB_LOGGING === 'true',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: redisPassword || undefined,
  REDIS_PASSWORD_FILE: process.env.REDIS_PASSWORD_FILE || undefined,

  // Meilisearch
  MEILISEARCH_HOST: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
  MEILISEARCH_MASTER_KEY: meilisearchMasterKey,
  MEILISEARCH_INDEX_PREFIX: process.env.MEILISEARCH_INDEX_PREFIX || 'thepurple',

  // Cloudflare R2
  CLOUDFLARE_R2_ACCOUNT_ID: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
  CLOUDFLARE_R2_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  CLOUDFLARE_R2_BUCKET: process.env.CLOUDFLARE_R2_BUCKET || 'thepurple-media',
  CLOUDFLARE_R2_PUBLIC_URL: process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://media.thepurple.in',

  // Razorpay
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,

  // Shiprocket
  SHIPROCKET_API_KEY: process.env.SHIPROCKET_API_KEY,
  SHIPROCKET_API_SECRET: process.env.SHIPROCKET_API_SECRET,

  // Admin Auth & Bootstrap
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ADMIN_INITIAL_EMAIL: adminInitialEmail,
  ADMIN_INITIAL_PASSWORD: adminInitialPassword,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'superadmin@gmail.com',

  // SMTP Mail Service
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',
  SMTP_FROM: process.env.SMTP_FROM || 'ThePurple <no-reply@thepurple.in>',

  isProduction,
  isDevelopment: process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
};

export default env;
