import { Router } from "express";
import { Routes } from "@interfaces/request.interface";
import { EquipmentBookingController } from "@src/controllers/equipment-booking.controller";
import { ValidationMiddlware } from "@src/middlewares/validation.middleware";
import {
  CreateEquipmentBookingSchema,
  QuoteBookingSchema,
  UpdateBookingStatusSchema,
} from "@validations/equipment-booking.validation";
import { Authorize } from "@src/middlewares/authorize.middleware";
import { UserRole } from "@src/enums/user.enum";

export class EquipmentBookingRoutes implements Routes {
  router: Router = Router();
  constructor() {
    this.initiallizeRoutes();
  }
  initiallizeRoutes = () => {
    const controller = new EquipmentBookingController();

    this.router.post(
      `/create`,
      Authorize(UserRole.USER),
      ValidationMiddlware(CreateEquipmentBookingSchema, "body"),
      controller.createBooking
    );

    // Lets the client show a total without recomputing it and disagreeing
    // with the server, which is how a 9,500 quote became a 19,500 booking.
    this.router.post(
      `/quote`,
      Authorize(UserRole.PUBLIC),
      ValidationMiddlware(QuoteBookingSchema, "body"),
      controller.quoteBooking
    );

    this.router.get("/user", Authorize(UserRole.USER), controller.getAllUserBookings);
    this.router.get("/deposits", Authorize(UserRole.USER), controller.getDepositLedger);

    this.router.patch(
      "/:id/status",
      Authorize(UserRole.USER),
      ValidationMiddlware(UpdateBookingStatusSchema, "body"),
      controller.updateStatus
    );

    this.router.get("/remainder", controller.getAllRemainders);
  };
}
