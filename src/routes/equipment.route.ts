import { EquipmentController } from "@src/controllers/equipment.controller";
import { Router } from "express";
import { Routes } from "@interfaces/request.interface";
import { ValidationMiddlware } from "@src/middlewares/validation.middleware";
import { EquipmentFilterSchema } from "@validations/equipment.validation";
import { Authorize } from "@src/middlewares/authorize.middleware";
import { UserRole } from "@src/enums/user.enum";

export class EquimentRoutes implements Routes {
  public router = Router();
  public baseUrl = "/equipment";
  constructor() {
    this.initiallizeRoutes();
  }
  public initiallizeRoutes = () => {
    const equipmentController = new EquipmentController();

    // Listing now requires a signed-in owner; it used to be open to anyone.
    this.router.post(
      `${this.baseUrl}`,
      Authorize(UserRole.USER),
      equipmentController.createEquipment
    );
    this.router.get(
      `${this.baseUrl}`,
      Authorize(UserRole.PUBLIC),
      equipmentController.getAllEquipments
    );
    this.router.post(
      `${this.baseUrl}/filter`,
      Authorize(UserRole.PUBLIC),
      ValidationMiddlware(EquipmentFilterSchema, "body"),
      equipmentController.filterEquipments
    );
    this.router.post(
      `${this.baseUrl}/recommendations`,
      Authorize(UserRole.PUBLIC),
      equipmentController.recommendEquipments
    );
    this.router.get(
      `${this.baseUrl}/:id/availability`,
      Authorize(UserRole.PUBLIC),
      equipmentController.getAvailability
    );
    this.router.post(
      `${this.baseUrl}/:id/abandoned-quote`,
      Authorize(UserRole.PUBLIC),
      equipmentController.recordAbandonedQuote
    );
    this.router.get(
      `${this.baseUrl}/:id`,
      Authorize(UserRole.PUBLIC),
      equipmentController.getEquipmentById
    );
  };
}
