import { IRequest } from "@interfaces/request.interface";
import HttpExceptionError from "@src/exception/httpexception";
import { CacheService } from "@src/services/cache.service";
import { isEmpty } from "@utils/data.util";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { v4 as uuid } from "uuid";

const cacheService = new CacheService();

export const IdempotencyMiddleware = (): RequestHandler => {
  const skipIdempotencyRoutes = ["/api/auth/login", "/api/auth/register"];
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (["POST", "PUT"].includes(req.method)) {
        if (skipIdempotencyRoutes.includes(req.path)) {
          return next();
        }
        await idempotencyHandler(req, res, next);
      } else {
        return next();
      }
    } catch (err) {
      next(
        new HttpExceptionError(
          500,
          "Something went wrong in idempotency middleware"
        )
      );
    }
  };
};

export const getIdempotencyKey = (req: Request) => {
  const key =
    req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
  if (key && typeof key == "string") {
    return key;
  } else if (key && typeof key == "object" && key.length > 0) {
    return key[0];
  } else {
    return null;
  }
};

export const generateIdempotencyKey = (key: string) => {};

export const idempotencyHandler = async (
  req: IRequest,
  res: Response,
  next: NextFunction
) => {
  console.log(req.route);
  const idempotencyKey = getIdempotencyKey(req);
  if (idempotencyKey) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(idempotencyKey)) {
      next(new HttpExceptionError(400, "Invalid Idempotency Key"));
    }
    const userId = req?.user?.userId || "public";
    const fullPath = req.originalUrl.split("?")[0];
    const endpoint = `${req.method}:${fullPath}`;
    const cachedHashKey = `${userId}:${endpoint}:${idempotencyKey}`;
    console.log("cache key :", cachedHashKey);
    req.idempotencyKey = idempotencyKey;
    const cachedResponse = await cacheService.getJson(
      "idempotency",
      cachedHashKey
    );
    console.log("cache response :", cachedResponse);
    if (cachedResponse) {
      return res.status(304).json(cachedResponse);
    }
    next();
  } else {
    next();
  }
};
