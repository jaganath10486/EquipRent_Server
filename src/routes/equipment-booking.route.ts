import { Router } from "express";
import { Routes } from "@interfaces/request.interface";
import { EquipmentBookingController } from "@src/controllers/equipment-booking.controller";
import { ValidationMiddlware } from "@src/middlewares/validation.middleware";
import { EquipmentBookingSchema } from "@src/models/equipments-booking.model";
import { CreateEquipmentBookingSchema } from "@validations/equipment-booking.validation";
import { Authorize } from "@src/middlewares/authorize.middleware";
import { UserRole } from "@src/enums/user.enum";

export class EquipmentBookingRoutes implements Routes {
  router: Router = Router();
  constructor() {
    this.initiallizeRoutes();
  }
  initiallizeRoutes = () => {
    const equipmentBookingController = new EquipmentBookingController();
    this.router.post(
      `/create`,
      Authorize(UserRole.USER),
      ValidationMiddlware(CreateEquipmentBookingSchema, "body"),
      equipmentBookingController.createBooking
    );
    this.router.get(
      "/user",
      Authorize(UserRole.USER),
      equipmentBookingController.getAllUserBookings
    );
  };
}
