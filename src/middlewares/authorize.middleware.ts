import { UserRole, ROLE_HIERARCHY } from "@src/enums/user.enum";
import { IRequest } from "@interfaces/request.interface";
import { Response, NextFunction, RequestHandler } from "express";
import HttpExceptionError from "@src/exception/httpexception";

export const Authorize = (
  minUserRole: UserRole = UserRole.PUBLIC,
  options: any = {}
): RequestHandler => {
  return async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      if (minUserRole == UserRole.PUBLIC) {
        return next();
      }
      if (!req.user) {
        throw new HttpExceptionError(403, "Authentication Failed");
      }
      const userRole = req.user.userRole;
      const userRoleLevel = ROLE_HIERARCHY[userRole] || 0;
      const requiredRoleLevel = ROLE_HIERARCHY[minUserRole] || 0;
      const hasRequiredRole = userRoleLevel >= requiredRoleLevel;
      if (hasRequiredRole) {
        return next();
      }
      throw new HttpExceptionError(403, "Authorization Failed");
    } catch (err) {
      next(err);
    }
  };
};
