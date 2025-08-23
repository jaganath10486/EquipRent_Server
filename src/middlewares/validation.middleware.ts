import { IRequest } from "@interfaces/request.interface";
import { ErrorTypes } from "@src/enums/error.enum";
import HttpExceptionError from "@src/exception/httpexception";
import { isEmpty } from "@utils/data.util";
import { NextFunction, RequestHandler, Response } from "express";
import { ZodSchema, ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export const ValidationMiddlware = (
  basicSchema: ZodSchema,
  type: "params" | "body" | "query" = "body"
): RequestHandler => {
  return (req: IRequest, res: Response, next: NextFunction) => {
    const data = req[type];
    const result = basicSchema.safeParse(data);
    if (!result.success) {
      const validatonError = fromZodError(result.error);
      next(new HttpExceptionError(400, validatonError.message, ErrorTypes.INVALID_PAYLOAD));
    }
    next();
  };
};
