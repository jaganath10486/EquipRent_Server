import { EquipmentController } from "@src/controllers/equipment.controller";
import { Router } from "express";
import { Routes } from "@interfaces/request.interface";
import { ValidationMiddlware } from "@src/middlewares/validation.middleware";
import { EquipmentFilterSchema } from "@validations/equipment.validation";
import { AuthMiddleware } from "@src/middlewares/auth.middleware";

export class EquimentRoutes implements Routes {
  public router = Router();
  public baseUrl = "/equipment";
  constructor() {
    this.initiallizeRoutes();
  }
  public initiallizeRoutes = () => {
    const equipmentController = new EquipmentController();
    this.router.post(`${this.baseUrl}`, equipmentController.createEquipment);
    this.router.get(
      `${this.baseUrl}`,
      equipmentController.getAllEquipments
    );
    this.router.post(
      `${this.baseUrl}/filter`,
      ValidationMiddlware(EquipmentFilterSchema, "body"),
      equipmentController.filterEquipments
    );
    this.router.get(
      `${this.baseUrl}/:id`,
      // AuthMiddleware(),
      equipmentController.getEquipmentById
    );
  };
}
