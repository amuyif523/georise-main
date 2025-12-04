import "dotenv/config";

const required = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const NODE_ENV = process.env.NODE_ENV || "development";
export const DATABASE_URL = required(process.env.DATABASE_URL, "DATABASE_URL");
export const JWT_SECRET = required(process.env.JWT_SECRET, "JWT_SECRET");
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
