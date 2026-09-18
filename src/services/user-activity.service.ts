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
import { EquipmentModel } from "@src/models/equipment.model";
import { ViewEventModel, InteractionType } from "@src/models/view-event.model";
import { CategoryPopulate, SubCategoryPopulate } from "@src/queries/equipment.query";
import { EquipmentClass } from "@src/classes/equipment.class";
import { availabilityService, DAY_MS } from "./availability.service";

export class UserActivityService {
  private userActivityModel = UserActivityModel();
  private userActivityCountService = new UserActivityCountService();
  private equipmentModel = EquipmentModel();
  private viewEventModel = ViewEventModel();
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
      if ([UserActivity.LIKE].includes(data.action)) {
        if (existingUserActivity[0].isActionTrue && data.isPositive === 1) {
          throw new HttpExceptionError(
            400,
            "User already performed the action"
          );
        }

        if (!existingUserActivity[0].isActionTrue && data.isPositive === 0) {
          throw new HttpExceptionError(
            400,
            "User Does not perform any action earlier"
          );
        }
      }
      const temp = await this.userActivityModel.findByIdAndUpdate(
        new Types.ObjectId(existingUserActivity[0]._id),
        { $set: { isPositive: data.isPositive } },
        { new: true, runValidators: true }
      );
      if ([UserActivity.LIKE].includes(data.action)) {
        await this.userActivityCountService.updateUserAcitivityCount(
          data.isPositive,
          data.userId,
          data.action
        );
      }
      return temp;
    } else {
      if (data.isPositive == 0) {
        throw new HttpExceptionError(
          400,
          "User doesnot perform any action earlier "
        );
      }
      let temp = await this.userActivityModel.create({ ...data });
      if ([UserActivity.LIKE].includes(data.action)) {
        await this.userActivityCountService.updateUserAcitivityCount(
          data.isPositive,
          data.userId,
          data.action
        );
      }
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

  /**
   * Views are recorded twice on purpose.
   *
   * `useractivity` keeps the upserted "has viewed" flag the recommendation
   * engine reads, and `viewevents` appends one row per occurrence so there is
   * an actual time series. The upsert alone could never answer "how often" or
   * "when", and that history cannot be reconstructed after the fact.
   */
  public recordView = async (equipmentId: string, userId?: string) => {
    try {
      await this.viewEventModel.create({
        equipmentId: new Types.ObjectId(equipmentId),
        userId: userId && isValidObjectId(userId) ? new Types.ObjectId(userId) : undefined,
        type: InteractionType.VIEW,
      });
    } catch (err: any) {
      console.error("[activity] view event failed:", err?.message ?? err);
    }
  };

  /**
   * A priced rental the user walked away from: the exact item, the exact dates
   * and the exact number that was too high. The single most precise
   * price-sensitivity signal in the product, and previously invisible.
   */
  public recordAbandonedQuote = async (payload: {
    equipmentId: string;
    userId?: string;
    quotedAmount: number;
    startDate: Date | string;
    endDate: Date | string;
  }) => {
    try {
      await this.viewEventModel.create({
        equipmentId: new Types.ObjectId(payload.equipmentId),
        userId:
          payload.userId && isValidObjectId(payload.userId)
            ? new Types.ObjectId(payload.userId)
            : undefined,
        type: InteractionType.QUOTE_ABANDONED,
        quotedAmount: payload.quotedAmount,
        startDate: new Date(payload.startDate),
        endDate: new Date(payload.endDate),
      });
    } catch (err: any) {
      console.error("[activity] abandoned quote failed:", err?.message ?? err);
    }
  };

  /**
   * The saved list.
   *
   * The navbar has shown a heart with a live count since the beginning, and it
   * was not a link and had no destination — users could save things and never
   * reach them again. Each entry also carries the next free window, which turns
   * a dead bookmark into something actionable.
   */
  public getLikedEquipments = async (userId: string, withAvailability = true) => {
    if (!isValidObjectId(userId)) {
      throw new HttpExceptionError(400, "Not a valid user Id");
    }
    const likes = await this.userActivityModel
      .find({
        userId: new Types.ObjectId(userId),
        action: UserActivity.LIKE,
        reference: UserActivityReference.EQUIPMENT,
        isPositive: 1,
      })
      .sort({ updatedAt: -1 })
      .lean();

    if (likes.length === 0) return [];

    const equipments = await this.equipmentModel
      .find({ _id: { $in: likes.map((like: any) => like.sourceId) } })
      .populate([...CategoryPopulate, ...SubCategoryPopulate])
      .lean();

    const savedAtById = new Map(
      likes.map((like: any) => [String(like.sourceId), like.updatedAt ?? like.createdAt ?? null])
    );

    return Promise.all(
      equipments.map(async (equipment: any) => {
        const base: Record<string, any> = {
          ...new EquipmentClass({ ...equipment, isLiked: true }),
          savedAt: savedAtById.get(String(equipment._id)) ?? null,
        };
        if (withAvailability) {
          base.nextFreeWindow = await availabilityService.findNextFreeWindow(
            String(equipment._id),
            new Date(),
            2
          );
          const { available, totalQuantity } =
            await availabilityService.getAvailableQuantity(
              String(equipment._id),
              new Date(),
              new Date(Date.now() + 7 * DAY_MS)
            );
          base.availableThisWeek = available;
          base.totalQuantity = totalQuantity;
        }
        return base;
      })
    );
  };
}
