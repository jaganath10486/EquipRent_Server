import { IRequest, IResult } from "@interfaces/request.interface";
import { CacheService } from "@src/services/cache.service";
import { isEmpty } from "@utils/data.util";
import { NextFunction, Response } from "express";

const cacheService = new CacheService();

export const ResponseModifier = (req: IRequest, res: any, next: any) => {
  try {
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    let statusCode = 200;

    res.status = function (code: number) {
      statusCode = code;
      return originalStatus(code);
    };

    res.json = async function (body: any) {
      const shouldCache = statusCode >= 200 && statusCode < 300;
      if (shouldCache && req.idempotencyKey) {
        const userId = req?.user?.userId || "public";
        const fullPath = req.originalUrl.split("?")[0];
        const endpoint = `${req.method}:${fullPath}`;
        const cachedHashKey = `${userId}:${endpoint}:${req.idempotencyKey}`;
        await cacheService.setJson("idempotency", body, cachedHashKey);
      }
      if (body?.skipResponseModifier) {
        originalJson(body);
      } else {
        const response: Partial<IResult> = {};
        if (res.isError) {
          response.data = body.data || null;
          if (!isEmpty(body.additionalData)) {
            response.additionalData = body.additionalData;
          }
          response.success = false;
          response.message = body.error.message;
          response.error = {
            description: body.error.message,
            statusCode: body.error.statusCode,
            errorType: body.error.errorType,
          };
        } else {
          response.data = body.data;
          response.success = true;
          if (body.pagination) {
            response.pagination = body.pagination;
          }
          if (body.additionalData) {
            response.additionalData = body.additionalData;
          }
          response.message = body.message || "Successfully executed";
        }
        originalJson(response);
      }
    };
    next();
  } catch (err) {
    next();
  }
};
