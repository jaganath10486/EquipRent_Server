import { MongoDBConfig } from "@interfaces/config.interface";
import dotenv from "dotenv";
dotenv.config();

export const {
  PORT,
  NODE_ENV,
  MONGODB_URL,
  JWT_SECRETE_KEY,
  IS_REDIS_CACHE_ENABLED,
  REDIS_URL,
  REDIS_TTL,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  RESEND_EMAIL_API_KEY,
  RESEND_EMAIL_API_ENABLED,
  EMAIL_ADDRESS = "",
  NODEEMAIL_PASS,
  NODEMAILER_EMAIL_ENABLED,
  REDIS_PORT,
  REDIS_HOST,
  REDIS_USERNAME,
  REDIS_PASSWORD,
} = process.env;

export const MongoDbAccessConfig: MongoDBConfig = {
  url: MONGODB_URL || "",
};

export const ISPROD = NODE_ENV == "production" ? true : false;
