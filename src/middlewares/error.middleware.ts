import { HttpExceptionErrorInterface } from "@interfaces/error.interface";
import { ErrorMessage, ErrorTypes } from "@src/enums/error.enum";
import HttpExceptionError from "@src/exception/httpexception";
import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

export const ErrorMiddleware = (
  error: HttpExceptionError,
  req: Request,
  res: any,
  next: NextFunction
) => {
  const data = error?.data || null;
  const message = error?.message || ErrorMessage;
  const statusCode = error?.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  const additionalData = error?.additionalData || {};
  const errorType = error.errorType || ErrorTypes.INTERNAL_SERVER_ERROR;
  res["isError"] = true;
  res["errorData"] = {
    data,
    message,
    statusCode,
    additionalData,
    errorType,
  };
  res.status(statusCode).json({
    data: data,
    error: {
      message,
      statusCode,
      errorType,
    },
    additionalData,
  });
};
