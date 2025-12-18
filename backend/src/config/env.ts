import 'dotenv/config';

const required = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const DATABASE_URL = required(process.env.DATABASE_URL, 'DATABASE_URL');
export const JWT_SECRET = required(process.env.JWT_SECRET, 'JWT_SECRET');
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
export const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const SMS_PROVIDER = (process.env.SMS_PROVIDER || 'console').toLowerCase();
export const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
export const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
export const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@georise.local';
export const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
