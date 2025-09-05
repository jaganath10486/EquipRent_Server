import { IRequest } from "@interfaces/request.interface";
import { UserActivityInterface } from "@interfaces/user-activity.interface";
import HttpExceptionError from "@src/exception/httpexception";
import { UserActivityService } from "@src/services/user-activity.service";
import { isValidObjectId } from "@validations/data.validation";
import { Response, NextFunction, RequestHandler } from "express";

export class UserActivityController {
  private userActivityService = new UserActivityService();
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
      console.log("response :", response);
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
}
