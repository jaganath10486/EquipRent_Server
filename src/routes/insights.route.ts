import { Router } from "express";
import { Routes } from "@interfaces/request.interface";
import { InsightsController } from "@src/controllers/insights.controller";
import { Authorize } from "@src/middlewares/authorize.middleware";
import { UserRole } from "@src/enums/user.enum";

export class InsightsRoutes implements Routes {
  public router: Router = Router();
  constructor() {
    this.initiallizeRoutes();
  }
  public initiallizeRoutes = () => {
    const controller = new InsightsController();

    // Owner console. Any signed-in user can own equipment, so USER is the gate.
    this.router.get("/owner/listings", Authorize(UserRole.USER), controller.getOwnerListings);
    this.router.get("/owner/bookings", Authorize(UserRole.USER), controller.getOwnerBookings);
    this.router.get("/owner/insights", Authorize(UserRole.USER), controller.getOwnerInsights);

    // Demand radar is useful to anyone deciding what to list.
    this.router.get("/demand", Authorize(UserRole.USER), controller.getDemandRadar);

    this.router.get("/rent-vs-buy", Authorize(UserRole.USER), controller.getRentVsBuy);
  };
}
