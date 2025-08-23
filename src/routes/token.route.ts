import { Routes } from "@interfaces/request.interface";
import { Router } from "express";
import { TokenController } from "@src/controllers/token.controller";
import { ValidationMiddlware } from "@src/middlewares/validation.middleware";
import { RefreshTokenSchema } from "@validations/token.validation";

export class TokenRoutes implements Routes {
  public router: Router = Router();
  constructor() {
    this.initiallizeRoutes();
  }
  initiallizeRoutes = () => {
    const tokenController = new TokenController();
    this.router.post(
      "/refresh-token",
      ValidationMiddlware(RefreshTokenSchema, "body"),
      tokenController.refreshAccessToken
    );
  };
}
