import { IRequest, IResult, Routes } from "@interfaces/request.interface";
import { UserController } from "@src/controllers/user.controller";
import { Router } from "express";

export class UserRoutes implements Routes {
  router = Router();
  constructor() {
    this.initiallizeRoutes();
  }
  initiallizeRoutes() {
    const userController = new UserController();
    this.router.get("/:id", userController.getUserById);
  }
}
