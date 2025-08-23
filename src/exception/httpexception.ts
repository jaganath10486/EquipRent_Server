import { HttpExceptionErrorInterface } from "@interfaces/error.interface";
import { StatusCodes } from "http-status-codes";

class HttpExceptionError extends Error implements HttpExceptionErrorInterface {
  public message;
  public statusCode;
  public data;
  public additionalData;
  public errorType;

  constructor(
    statusCode: StatusCodes,
    message: string,
    errorType?: string,
    data?: any,
    additionalData?: any
  ) {
    super();
    this.additionalData = additionalData;
    this.data = data;
    this.errorType = errorType;
    this.message = message;
    this.statusCode = statusCode;
  }
}

export default HttpExceptionError;
