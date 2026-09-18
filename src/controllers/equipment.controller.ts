import HttpExceptionError from "@src/exception/httpexception";
import { equipmentService } from "@src/services/equipment.service";
import { IRequest } from "@interfaces/request.interface";
import { Response, NextFunction } from "express";
import { availabilityService, DAY_MS } from "@src/services/availability.service";
import { UserActivityService } from "@src/services/user-activity.service";

export class EquipmentController {
  private equipmentService = equipmentService;
  private userActivityService = new UserActivityService();
  public getAllEquipments = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data = await this.equipmentService.getEquipments({
        isActive: true,
      });
      res.status(200).json({ data });
      return;
    } catch (err) {
      next(err);
    }
  };
  public createEquipment = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // Listing was an unauthenticated endpoint with no owner attached, so
      // nothing tied a piece of equipment to the person renting it out.
      const ownerId = req.user?.userId;
      if (!ownerId) {
        throw new HttpExceptionError(401, "Sign in to list equipment");
      }
      const data = await equipmentService.createEquipment({
        ...req.body,
        userId: ownerId,
      });
      res
        .status(201)
        .json({ data: data, message: "Successfully created equipment" });
      return;
    } catch (err) {
      next(err);
    }
  };
  public getEquipmentById = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const id = req.params.id.toString();
      const userId: any = req.user?.userId || "";
      const data = await this.equipmentService.getEquipmentById(id, userId);
      if (!data) {
        throw new HttpExceptionError(204, "No equipment data fount");
      }
      // Append-only view log, so there is a real time series rather than a
      // single upserted "has viewed" flag with no timestamp.
      void this.userActivityService.recordView(id, userId);
      res.status(200).json({ data, message: "Fetched Equipment Data" });
      return;
    } catch (err) {
      next(err);
    }
  };

  public filterEquipments = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const payload = await req.body;
      const data = await this.equipmentService.filterEquipments(payload);
      res
        .status(200)
        .json({ data: data, message: "Fetched the filtered data" });
      return;
    } catch (err) {
      next(err);
    }
  };
  public recommendEquipments = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user?.userId || "";
      if (!userId) {
        res.status(200).json({ data: { items: [], reasons: [], profileSummary: "", isAiPowered: false }, message: "Fetched recommendations" });
        return;
      }
      const data = await this.equipmentService.getRecommendedEquipments(userId);
      res.status(200).json({ data, message: "Fetched recommendations" });
      return;
    } catch (err) {
      next(err);
    }
  };

  /**
   * The calendar feed. Without this the date picker offered every day of the
   * year regardless of what was already booked.
   */
  public getAvailability = async (req: IRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const from = req.query.from ? new Date(String(req.query.from)) : new Date();
      const to = req.query.to
        ? new Date(String(req.query.to))
        : new Date(Date.now() + 180 * DAY_MS);

      const data = await availabilityService.getAvailabilityWindow(id, from, to);
      res.status(200).json({ data, message: "Fetched availability" });
    } catch (err) {
      next(err);
    }
  };

  /** Fire-and-forget signal when someone prices a rental and leaves. */
  public recordAbandonedQuote = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      await this.userActivityService.recordAbandonedQuote({
        equipmentId: String(req.params.id),
        userId: req.user?.userId,
        quotedAmount: Number(req.body?.quotedAmount) || 0,
        startDate: req.body?.startDate,
        endDate: req.body?.endDate,
      });
      res.status(202).json({ data: null, message: "Recorded" });
    } catch (err) {
      next(err);
    }
  };
}
