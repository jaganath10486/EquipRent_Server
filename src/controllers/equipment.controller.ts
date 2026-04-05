import HttpExceptionError from "@src/exception/httpexception";
import { equipmentService } from "@src/services/equipment.service";
import { IRequest } from "@interfaces/request.interface";
import { Response, NextFunction } from "express";

export class EquipmentController {
  private equipmentService = equipmentService;
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
      const payload = req.body;
      const data = await equipmentService.createEquipment(payload);
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
}
