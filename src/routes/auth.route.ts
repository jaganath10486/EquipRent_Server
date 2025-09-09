import { Routes } from "@interfaces/request.interface";
import { AuthController } from "@src/controllers/auth.controller";
import { Router } from "express";
import { ValidationMiddlware } from "@src/middlewares/validation.middleware";
import {
  EmailLoginSchema,
  EmailRegisterSchema,
  GoogleAuthentication,
} from "@validations/auth.validation";
import { Authorize } from "@src/middlewares/authorize.middleware";
import { UserRole } from "@src/enums/user.enum";

export class AuthRoutes implements Routes {
  public router: Router = Router();
  public initiallizeRoutes = () => {
    const authController = new AuthController();
    this.router.post(
      "/verify-email",
      ValidationMiddlware(EmailLoginSchema),
      authController.veirfyEmail
    );
    this.router.post(
      "/register-email",
      ValidationMiddlware(EmailRegisterSchema),
      authController.registerEmail
    );
    this.router.post(
      "/google-oauth",
      Authorize(UserRole.PUBLIC),
      ValidationMiddlware(GoogleAuthentication, "body"),
      authController.googleAuthentication
    );
  };
  constructor() {
    this.initiallizeRoutes();
  }
}
