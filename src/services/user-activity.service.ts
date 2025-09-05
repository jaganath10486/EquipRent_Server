import { UserActivityInterface } from "@interfaces/user-activity.interface";
import {
  UserActivity,
  UserActivityReference,
} from "@src/enums/user-activity.enum";
import HttpExceptionError from "@src/exception/httpexception";
import { UserActivityModel } from "@src/models/user-activity.model";
import { isValidObjectId } from "@validations/data.validation";
import { Types } from "mongoose";
import { UserActivityCountService } from "./user-activity-count.service";

export class UserActivityService {
  private userActivityModel = UserActivityModel();
  private userActivityCountService = new UserActivityCountService();
  constructor() {}
  performAction = async (
    sourceId: string,
    userId: string,
    referenceType: UserActivityReference,
    isPositive: number,
    action: UserActivity
  ) => {
    this.validatePayload(sourceId, userId);
    let data: UserActivityInterface = {
      sourceId: new Types.ObjectId(sourceId),
      userId: new Types.ObjectId(userId),
      isPositive: isPositive,
      reference: referenceType,
      action: action,
    };
    const res = await this.handleActivity(data);
    if (!res) {
      throw new HttpExceptionError(
        500,
        "Something went wrong in performing action"
      );
    }
    return res;
  };

  private validatePayload(sourceId: string, userId: string): void {
    if (!isValidObjectId(sourceId) || !isValidObjectId(userId)) {
      throw new Error(
        `The payload is invalid for the specified activity type.`
      );
    }
  }

  private getExistingActivity = async (
    data: UserActivityInterface
  ): Promise<{ isActionTrue: boolean; _id: string }[] | null> => {
    let query = [
      {
        $match: {
          sourceId: data.sourceId,
          userId: data.userId,
          action: data.action,
          reference: data.reference,
        },
      },
      { $group: { _id: "$_id", count: { $sum: "$isPositive" } } },
      { $project: { _id: 1, isActionTrue: { $gt: ["$count", 0] } } },
    ];
    const userAction = await this.userActivityModel.aggregate(query);
    return userAction;
  };

  private handleActivity = async (
    data: UserActivityInterface
  ): Promise<any> => {
    const existingUserActivity = await this.getExistingActivity(data);
    if (existingUserActivity && existingUserActivity.length > 0) {
      if (existingUserActivity[0].isActionTrue && data.isPositive === 1) {
        throw new HttpExceptionError(400, "User already performed the action");
      }

      if (!existingUserActivity[0].isActionTrue && data.isPositive === 0) {
        throw new HttpExceptionError(
          400,
          "User Does not perform any action earlier"
        );
      }
      const temp = await this.userActivityModel.findByIdAndUpdate(
        new Types.ObjectId(existingUserActivity[0]._id),
        { $set: { isPositive: data.isPositive } },
        { new: true, runValidators: true }
      );
      await this.userActivityCountService.updateUserAcitivityCount(
        data.isPositive,
        data.userId,
        data.action
      );
      return temp;
    } else {
      if (data.isPositive == 0) {
        throw new HttpExceptionError(
          400,
          "User doesnot perform any action earlier "
        );
      }
      let temp = await this.userActivityModel.create({ ...data });
      await this.userActivityCountService.updateUserAcitivityCount(
        data.isPositive,
        data.userId,
        data.action
      );
      return temp;
    }
  };

  public getUserActivityBySource = async (
    userId: Types.ObjectId,
    sourceIds: any[],
    reference: string,
    actions: UserActivity[]
  ) => {
    const res = await this.userActivityModel.aggregate([
      {
        $match: {
          userId: userId,
          sourceId: { $in: sourceIds },
          reference,
          action: { $in: actions },
          isPositive: 1,
        },
      },
    ]);
    return res;
  };
}
