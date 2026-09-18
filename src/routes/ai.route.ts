import { Router } from "express";
import { Routes } from "@interfaces/request.interface";
import { Authorize } from "@src/middlewares/authorize.middleware";
import { UserRole } from "@src/enums/user.enum";
import { AIController } from "@src/controllers/ai.controller";
import { ValidationMiddlware } from "@src/middlewares/validation.middleware";
import {
  CompareEquipmentSchema,
  NaturalSearchRequestSchema,
  KitRequestSchema,
} from "@validations/equipment.validation";

export class AIRoutes implements Routes {
  public router = Router();

  constructor() {
    this.initiallizeRoutes();
  }

  public initiallizeRoutes = () => {
    const aiController = new AIController();

    this.router.post(
      "/search",
      Authorize(UserRole.PUBLIC),
      ValidationMiddlware(NaturalSearchRequestSchema, "body"),
      aiController.naturalSearchEquipments
    );

    // Turns an occasion into an availability-checked, priced bill of materials.
    this.router.post(
      "/kit",
      Authorize(UserRole.PUBLIC),
      ValidationMiddlware(KitRequestSchema, "body"),
      aiController.buildKit
    );

    this.router.post(
      "/equipment/compare",
      ValidationMiddlware(CompareEquipmentSchema, "body"),
      aiController.compareEquipments
    );

    this.router.get(
      "/equipment/:id/summarize",
      Authorize(UserRole.PUBLIC),
      aiController.summarizeEquipment
    );
  };
}
