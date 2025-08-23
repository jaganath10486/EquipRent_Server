import { StatusCodes } from "http-status-codes";

export interface HttpExceptionErrorInterface {
  statusCode: StatusCodes;
  message: string;
  data: any;
  errorType?: string;
  additionalData?: any;
}
