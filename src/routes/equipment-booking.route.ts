import { Router } from "express";
import { Routes } from "@interfaces/request.interface";
import { EquipmentBookingController } from "@src/controllers/equipment-booking.controller";
import { AuthMiddleware } from "@src/middlewares/auth.middleware";
import { ValidationMiddlware } from "@src/middlewares/validation.middleware";
import { EquipmentBookingSchema } from "@src/models/equipments-booking.model";
import { CreateEquipmentBookingSchema } from "@validations/equipment-booking.validation";

export class EquipmentBookingRoutes implements Routes {
  router: Router = Router();
  constructor() {
    this.initiallizeRoutes();
  }
  initiallizeRoutes = () => {
    const equipmentBookingController = new EquipmentBookingController();
    this.router.post(
      `/create`,
      AuthMiddleware(),
      ValidationMiddlware(CreateEquipmentBookingSchema, "body"),
      equipmentBookingController.createBooking
    );
    this.router.get(
      "/user",
      AuthMiddleware(),
      equipmentBookingController.getAllUserBookings
    );
  };
}
