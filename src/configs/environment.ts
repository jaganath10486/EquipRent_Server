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
} = process.env;

export const MongoDbAccessConfig: MongoDBConfig = {
  url: MONGODB_URL || "",
};

export const ISPROD = NODE_ENV == "production" ? true : false;
