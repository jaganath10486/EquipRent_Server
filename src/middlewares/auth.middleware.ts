import { API_KEY } from "@configs/index";
import { IRequest } from "@interfaces/request.interface";
import { ErrorTypes } from "@src/enums/error.enum";
import { SignInProvider, UserRole } from "@src/enums/user.enum";
import HttpExceptionError from "@src/exception/httpexception";
import { isEmpty } from "@utils/data.util";
import { veirfyJWTToken } from "@utils/jwt.util";
import { Response, NextFunction, RequestHandler, Request } from "express";

export const AuthMiddleware = (): RequestHandler => {
  const endspointsToSkipAuthentication = ["/login", "/register"];
  const endpointsForCustomAuth = ["/google-oauth"];
  return (req: IRequest, res: Response, next: NextFunction) => {
    req.user = {
      mobileNumber: 0,
      emailId: "",
      userRole: UserRole.PUBLIC,
      provider: SignInProvider.EMAIL,
      userName: "",
      userId: "",
    };
    try {
      if (endspointsToSkipAuthentication.includes(req.path)) {
        return next();
      }
      if (endpointsForCustomAuth.includes(req.path)) {
        return handleApiKeyValidations(req, res, next);
      }
      return handleBearerTokenValidation(req, next);
      // next(new HttpExceptionError(401, "No Access Token Found"));
    } catch (err) {
      console.log("error in middleware :", err);
      next(err);
    }
  };
};

const handleBearerTokenValidation = async (
  req: IRequest,
  next: NextFunction
) => {
  try {
    if (!req.headers.authorization) {
      throw new HttpExceptionError(401, "No Authorization header found");
    }
    const authorization = req.headers.authorization;
    const token = getToken(authorization);
    if (isEmpty(token)) {
      throw new HttpExceptionError(401, "No Bearer Token Found");
    }
    const decoded: any = veirfyJWTToken(token);
    if (!decoded) {
      throw new HttpExceptionError(401, "Token Expired");
    }
    req.user = { ...decoded };
    return next();
  } catch (err) {
    return next(err);
  }
};

const getToken = (authHeader: string) => {
  const [scheme, token] = authHeader.split(" ");
  if (scheme && scheme.toLowerCase() === "bearer" && token) {
    return token;
  }
  return "";
};

const handleApiKeyValidations = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let api_key = req.headers.api_key;
  if (isEmpty(api_key)) {
    next(
      new HttpExceptionError(
        400,
        "Api Key is required",
        ErrorTypes.PAYLOAD_NOT_AVAILABLE
      )
    );
  }
  if (req.headers.api_key == API_KEY) {
    next();
  } else {
    next(
      new HttpExceptionError(404, "Invalid Api Key", ErrorTypes.INVALID_PAYLOAD)
    );
  }
};
