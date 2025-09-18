import { IRequest } from "@interfaces/request.interface";
import { UserActivityInterface } from "@interfaces/user-activity.interface";
import HttpExceptionError from "@src/exception/httpexception";
import { UserActivityCountService } from "@src/services/user-activity-count.service";
import { UserActivityService } from "@src/services/user-activity.service";
import { isValidObjectId } from "@validations/data.validation";
import { Response, NextFunction, RequestHandler } from "express";

export class UserActivityController {
  private userActivityService = new UserActivityService();
  private userActivityCountService = new UserActivityCountService();
  performAction: (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => Promise<any> = async (req, res, next) => {
    try {
      const payload: UserActivityInterface = req.body;
      this.isObjectIdValid(
        payload.sourceId.toString(),
        payload.userId.toString()
      );
      const response = await this.userActivityService.performAction(
        payload.sourceId.toString(),
        payload.userId.toString(),
        payload.reference,
        payload.isPositive,
        payload.action
      );
      return res.status(201).json({
        data: payload,
        message: "Successfully performed the action.",
      });
    } catch (err) {
      next(err);
    }
  };
  isObjectIdValid = (sourceId: any, userId: any) => {
    if (!isValidObjectId(sourceId) || !isValidObjectId(userId)) {
      throw new HttpExceptionError(400, "Source Id or User Id is not valid");
    }
  };
  getUserActivityCount = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = await this.userActivityCountService.getUserActivityCount(
        userId
      );
      res.status(200).json({ data: data });
    } catch (err) {
      next(err);
    }
  };
}
