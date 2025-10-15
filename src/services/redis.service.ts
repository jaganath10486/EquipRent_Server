import { createClient, RedisClientType } from "redis";
import { toBoolean } from "@utils/data.util";
import {
  IS_REDIS_CACHE_ENABLED,
  REDIS_URL,
  REDIS_USERNAME,
  REDIS_PASSWORD,
  REDIS_HOST,
  REDIS_PORT,
} from "@configs/environment";

export class RedisService {
  private static instance: RedisService;
  private client!: RedisClientType;

  private constructor() {
    this.initiallizeRedisCaching();
  }

  public static getInstanace(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private initiallizeRedisCaching() {
    if (toBoolean(IS_REDIS_CACHE_ENABLED) && !this.client) {
      this.client = createClient({
        username: REDIS_USERNAME,
        password: REDIS_PASSWORD,
        socket: {
          host: REDIS_HOST,
          port: Number(REDIS_PORT),
        },
      });
      this.client
        .connect()
        .then(() => {
          console.log("Redis Connected Successfully");
        })
        .catch((err) => {
          console.error("Failed to connect the redis cache", err);
        });
      this.client.on("error", (error) => console.error("Redis error:", error));
    }
  }

  public async get(key: string, hashedKey?: string): Promise<string | null> {
    if (hashedKey) {
      return await this.client.get(`${key}: ${hashedKey}`);
    } else {
      return await this.client.get(`${key}`);
    }
  }

  public async set(
    key: string,
    value: string,
    hashedKey?: string,
    exp?: number
  ): Promise<void> {
    if (hashedKey) {
      if (exp && exp > 0) {
        this.client.setEx(`${key}: ${hashedKey}`, exp, value);
      } else {
        this.client.set(`${key}: ${hashedKey}`, value);
      }
    } else {
      if (exp && exp > 0) {
        this.client.setEx(`${key}`, exp, value);
      } else {
        this.client.set(`${key}`, value);
      }
    }
  }

  public async isKeyExists(key: string, hashedKey?: string): Promise<number> {
    if (hashedKey) {
      return await this.client.exists(`${key}: ${hashedKey}`);
    } else {
      return await this.client.exists(`${key}`);
    }
  }

  public async delete(key: string, hashedKey?: string): Promise<number> {
    if (hashedKey) {
      return await this.client.del(`${key}: ${hashedKey}`);
    } else {
      return await this.client.del(key);
    }
  }
  public async quit(): Promise<void> {
    await this.client.quit();
  }

  public async getJson(key: string, hashedKey?: string): Promise<any | null> {
    let value;
    if (hashedKey) {
      value = await this.client.get(`${key}: ${hashedKey}`);
    } else {
      value = await this.client.get(`${key}`);
    }
    if (value) {
      return JSON.parse(value);
    } else {
      value;
    }
  }

  public async setJson(
    key: string,
    value: any,
    hashedKey?: string,
    exp?: number
  ): Promise<void> {
    let data = JSON.stringify(value);
    if (hashedKey) {
      if (exp && exp > 0) {
        this.client.setEx(`${key}: ${hashedKey}`, exp, data);
      } else {
        this.client.set(`${key}: ${hashedKey}`, data);
      }
    } else {
      if (exp && exp > 0) {
        this.client.setEx(`${key}`, exp, data);
      } else {
        this.client.set(`${key}`, data);
      }
    }
  }
}
