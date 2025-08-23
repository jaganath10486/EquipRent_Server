import { IS_REDIS_CACHE_ENABLED } from "@configs/environment";
import { RedisService } from "./redis.service";
import crypto from "crypto";

export class CacheService {
  private redisService: RedisService;
  constructor() {
    this.redisService = RedisService.getInstanace();
  }
  public async set(
    key: string,
    value: any,
    path?: string,
    exp?: number
  ): Promise<void> {
    if (IS_REDIS_CACHE_ENABLED) {
      if (path) {
        let hashedKey = this.generateHashKey(path);
        await this.redisService.set(key, value, hashedKey, exp);
      } else {
        await this.redisService.set(key, value, path, exp);
      }
    }
  }

  public async get(key: string, path?: string): Promise<string | null> {
    if (IS_REDIS_CACHE_ENABLED) {
      if (path) {
        const hashedKey = this.generateHashKey(path);
        return await this.redisService.get(key, hashedKey);
      } else {
        return await this.redisService.get(key, path);
      }
    } else {
      return null;
    }
  }

  public async delete(key: string, path?: string): Promise<number> {
    if (IS_REDIS_CACHE_ENABLED) {
      if (path) {
        const hashedKey = this.generateHashKey(path);
        return await this.redisService.delete(key, hashedKey);
      } else {
        return await this.redisService.delete(key);
      }
    } else {
      return 0;
    }
  }

  public async setJson(
    key: string,
    value: any,
    path?: string,
    exp?: number
  ): Promise<void> {
    if (IS_REDIS_CACHE_ENABLED) {
      if (path) {
        let hashedKey = this.generateHashKey(path);
        await this.redisService.setJson(key, value, hashedKey, exp);
      } else {
        await this.redisService.setJson(key, value, path, exp);
      }
    }
  }

  public async getJson(key: string, path?: string): Promise<any | null> {
    if (IS_REDIS_CACHE_ENABLED) {
      if (path) {
        const hashedKey = this.generateHashKey(path);
        return await this.redisService.getJson(key, hashedKey);
      } else {
        return await this.redisService.getJson(key, path);
      }
    } else {
      return null;
    }
  }

  private generateHashKey(path: string) {
    return crypto.createHash("sha256").update(path).digest("hex");
  }
}
