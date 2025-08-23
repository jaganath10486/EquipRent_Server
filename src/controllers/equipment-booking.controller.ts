import { IRequest } from "@interfaces/request.interface";
import { Response, NextFunction } from "express";
import { EquipmentBookingService } from "@src/services/equipment-booking.service";
import { CacheService } from "@src/services/cache.service";

export class EquipmentBookingController {
  private equipmentBookingService = new EquipmentBookingService();
  public createBooking = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const payload = req.body;
      const userId = req.user?.userId || "";
      const data = await this.equipmentBookingService.createBooking(
        payload,
        userId
      );
      res.status(201).json({
        data: [],
        message: "Successfully created the equipments booking",
      });
      return;
    } catch (err) {
      next(err);
    }
  };

  public getAllUserBookings = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user?.userId || "";
      const userBookings =
        await this.equipmentBookingService.getAllBookingsByUserId(userId);
      res.status(200).json({
        data: userBookings,
        message: "Fetched user booking Successfully",
      });
      return;
    } catch (err) {
      next(err);
    }
  };
}
