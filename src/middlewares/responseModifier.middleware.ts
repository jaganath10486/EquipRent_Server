import { IRequest, IResult } from "@interfaces/request.interface";
import { isEmpty } from "@utils/data.util";
import { NextFunction, Response } from "express";

export const ResponseModifier = (req: Request, res: any, next: any) => {
  try {
    const originalJson = res.json;
    res.json = function (body: any) {
      if (body?.skipResponseModifier) {
        originalJson.call(this, body);
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
        originalJson.call(this, response);
      }
    };
    next();
  } catch (err) {
    next();
  }
};
