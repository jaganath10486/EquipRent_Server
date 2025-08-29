import { Request, RequestHandler, Response, NextFunction } from "express";
import HttpExceptionError from "@src/exception/httpexception";
import { ErrorTypes } from "@src/enums/error.enum";

export const ApiKeyValidationMiddleware = (
  expectedKey: string
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      let api_key = req.headers.api_key;
      if (!api_key) {
        throw new HttpExceptionError(
          400,
          "No Api key found",
          ErrorTypes.PAYLOAD_NOT_AVAILABLE
        );
      }
      if (api_key != expectedKey) {
        throw new HttpExceptionError(
          400,
          "Api Key Mismatch",
          ErrorTypes.INVALID_PAYLOAD
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};
