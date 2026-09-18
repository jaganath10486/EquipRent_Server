import { IRequest } from "@interfaces/request.interface";
import { Response, NextFunction } from "express";
import { equipmentBookingService } from "@src/services/equipment-booking.service";
import { equipmentBookingRemainder } from "@src/services/cron/equipment-booking-remainder";
import { EquipmentBookingStatus } from "@src/enums/equipment.enum";
import HttpExceptionError from "@src/exception/httpexception";

export class EquipmentBookingController {
  private equipmentBookingService = equipmentBookingService;

  public createBooking = async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.equipmentBookingService.createBooking(
        req.body,
        req.user?.userId || ""
      );
      // The booking used to be returned as `data: []`, so the client had no id
      // to link to and nothing to show beyond a popup.
      res.status(201).json({
        data,
        message: "Successfully created the equipments booking",
      });
    } catch (err) {
      next(err);
    }
  };

  /** Price and availability without writing anything. */
  public quoteBooking = async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.equipmentBookingService.quoteBooking(req.body?.items);
      res.status(200).json({ data, message: "Quoted booking" });
    } catch (err) {
      next(err);
    }
  };

  public getAllUserBookings = async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.equipmentBookingService.getAllBookingsByUserId(
        req.user?.userId || ""
      );
      res.status(200).json({ data, message: "Fetched user booking Successfully" });
    } catch (err) {
      next(err);
    }
  };

  public updateStatus = async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      const { status, reason } = req.body ?? {};
      if (!Object.values(EquipmentBookingStatus).includes(status)) {
        throw new HttpExceptionError(400, "Unknown booking status");
      }
      const data = await this.equipmentBookingService.updateBookingStatus(
        String(req.params.id),
        status,
        req.user?.userId || "",
        reason
      );
      res.status(200).json({ data, message: `Booking marked ${status}` });
    } catch (err) {
      next(err);
    }
  };

  public getDepositLedger = async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.equipmentBookingService.getDepositLedger(
        req.user?.userId || ""
      );
      res.status(200).json({ data, message: "Fetched deposit ledger" });
    } catch (err) {
      next(err);
    }
  };

  public getAllRemainders = async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      const data = await equipmentBookingRemainder.preview(
        Number(req.query.days) || 2
      );
      res.status(200).json({ data, message: "Fetched upcoming reminders" });
    } catch (err) {
      next(err);
    }
  };
}
