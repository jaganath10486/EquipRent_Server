import { IRequest } from "@interfaces/request.interface";
import { Response, NextFunction } from "express";
import { insightsService } from "@src/services/insights.service";
import { equipmentService } from "@src/services/equipment.service";
import { equipmentBookingService } from "@src/services/equipment-booking.service";

export class InsightsController {
  /** Owner console: listings with utilisation and booking counts. */
  public getOwnerListings = async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      const data = await equipmentService.getEquipmentsByOwner(req.user?.userId || "");
      res.status(200).json({ data, message: "Fetched owner listings" });
    } catch (err) {
      next(err);
    }
  };

  /** Owner console: the request queue for equipment this user owns. */
  public getOwnerBookings = async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      const data = await equipmentBookingService.getBookingsForOwner(
        req.user?.userId || ""
      );
      res.status(200).json({ data, message: "Fetched owner bookings" });
    } catch (err) {
      next(err);
    }
  };

  public getOwnerInsights = async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      const windowDays = Number(req.query.windowDays) || 30;
      const data = await insightsService.getOwnerInsights(
        req.user?.userId || "",
        windowDays
      );
      res.status(200).json({ data, message: "Fetched owner insights" });
    } catch (err) {
      next(err);
    }
  };

  public getDemandRadar = async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      const windowDays = Number(req.query.windowDays) || 30;
      const data = await insightsService.getDemandRadar(windowDays);
      res.status(200).json({ data, message: "Fetched demand radar" });
    } catch (err) {
      next(err);
    }
  };

  public getRentVsBuy = async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      const data = await insightsService.getRentVsBuy(req.user?.userId || "");
      res.status(200).json({ data, message: "Fetched rent vs buy" });
    } catch (err) {
      next(err);
    }
  };
}
