import { Router } from "express";
import { UserActivityController } from "@src/controllers/user-activity.controller";
import { ValidationMiddlware } from "@src/middlewares/validation.middleware";
import { Routes } from "@interfaces/request.interface";
import { UserActivityValidation } from "@validations/user-activity.validation";
import { Authorize } from "@src/middlewares/authorize.middleware";
import { UserRole } from "@src/enums/user.enum";

export class UserActivityRoutes implements Routes {
  public router: Router = Router();
  constructor() {
    this.initiallizeRoutes();
  }
  initiallizeRoutes = () => {
    const userActivityController = new UserActivityController();
    this.router.post(
      "/perform",
      Authorize(UserRole.USER),
      ValidationMiddlware(UserActivityValidation, "body"),
      userActivityController.performAction
    );
    // The navbar heart has always shown a count and linked nowhere.
    this.router.get(
      "/saved",
      Authorize(UserRole.USER),
      userActivityController.getSavedEquipments
    );
    this.router.get(
      "/count",
      Authorize(UserRole.USER),
      userActivityController.getUserActivityCount
    );
  };
}
