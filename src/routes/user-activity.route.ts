import { Router } from "express";
import { UserActivityController } from "@src/controllers/user-activity.controller";
import { ValidationMiddlware } from "@src/middlewares/validation.middleware";
import { Routes } from "@interfaces/request.interface";
import { AuthMiddleware } from "@src/middlewares/auth.middleware";
import { UserActivityValidation } from "@validations/user-activity.validation";

export class UserActivityRoutes implements Routes {
  public router: Router = Router();
  constructor() {
    this.initiallizeRoutes();
  }
  initiallizeRoutes = () => {
    const userActivityController = new UserActivityController();
    this.router.post(
      "/perform",
    //   AuthMiddleware(),
      ValidationMiddlware(UserActivityValidation, "body"),
      userActivityController.performAction
    );
  };
}
