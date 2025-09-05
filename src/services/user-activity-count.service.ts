import { UserActivity } from "@src/enums/user-activity.enum";
import HttpExceptionError from "@src/exception/httpexception";
import { UserActivityCountModel } from "@src/models/user-activity-count.model";
import { isValidObjectId } from "@validations/data.validation";
import { Types } from "mongoose";

export class UserActivityCountService {
  private userActivityCountModel = UserActivityCountModel();
  constructor() {}
  updateUserAcitivityCount = async (
    flag: number,
    userId: any,
    operation: UserActivity
  ) => {
    this.validatePayload(userId);
    let value = flag ? 1 : -1;
    if (operation == UserActivity.LIKE) {
      await this.userActivityCountModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $inc: { totalLikes: value } },
        { upsert: true, new: true }
      );
    } else {
      throw new HttpExceptionError(400, "Unsopprted activity count");
    }
  };

  private validatePayload(userId: string): void {
    if (!isValidObjectId(userId)) {
      throw new Error(
        `The payload is invalid for the specified activity type.`
      );
    }
  }
}
