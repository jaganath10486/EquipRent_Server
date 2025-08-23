import { SignInProvider, UserRole } from "@src/enums/user.enum";
import { Request, Router } from "express";
export interface IRequest extends Request {
  user?: {
    mobileNumber?: number;
    emailId?: string;
    userRole: UserRole;
    provider: SignInProvider;
    usserName: string;
    userId: string;
  };
}

export interface IResult {
  data: any;
  pagination?: any;
  error?: {
    description?: string;
    statusCode?: any;
    errorType?: any;
  };

  message: string;
  success: boolean;
  additionalData?: any;
}

export interface Routes {
  baseUrl?: string;
  initiallizeRoutes: () => void;
  router: Router;
}
