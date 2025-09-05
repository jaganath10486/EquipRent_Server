import {
  UserActivityReference,
  UserActivity,
} from "@src/enums/user-activity.enum";
import { Types } from "mongoose";

export interface UserActivityInterface {
  sourceId: Types.ObjectId;
  userId: Types.ObjectId;
  reference: UserActivityReference;
  isPositive: number;
  action: UserActivity;
  createdAt?: Date; // better as Date
  updatedAt?: Date;
}
