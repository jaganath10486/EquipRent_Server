import { IRequest } from "@interfaces/request.interface";
import { UserRole } from "@src/enums/user.enum";
import HttpExceptionError from "@src/exception/httpexception";
import { isEmpty } from "@utils/data.util";
import { veirfyJWTToken } from "@utils/jwt.util";
import { Response, NextFunction, RequestHandler } from "express";

export const AuthMiddleware = (): RequestHandler => {
  const endspointsToSkipAuthentication = [
    "/api/auth/login",
    "api/auth/register",
  ];
  const endpointsForCustomAuth = [""];

  return (req: IRequest, res: Response, next: NextFunction) => {
    try {
      console.log("req :", req.headers);
      if (endspointsToSkipAuthentication.includes(req.path)) {
        next();
      }
      if (endpointsForCustomAuth.includes(req.path)) {
        next();
      }
      return handleBearerTokenValidation(req, next);
      // next(new HttpExceptionError(401, "No Access Token Found"));
    } catch (err) {
      console.log("error in middleware :", err);
      next(err);
    }
  };
};

const handleBearerTokenValidation = async(req: IRequest, next: NextFunction) => {
  try {
    if (!req.headers.authorization) {
      throw new HttpExceptionError(401, "No Authorization header found");
    }
    const authorization = req.headers.authorization;
    const token = getToken(authorization);
    if (isEmpty(token)) {
      throw new HttpExceptionError(401, "No Bearer Token Found");
    }
    const decoded: any = await veirfyJWTToken(token);
    if (!decoded) {
      throw new HttpExceptionError(401, "Token Expired");
    }
    console.log("decoded :", decoded);
    req.user = { ...decoded };
    return next();
  } catch (err) {
    console.log("error :", err);
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

const handleApiKeyValidations = () => {};
