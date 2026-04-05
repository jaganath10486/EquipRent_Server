import { Types } from "mongoose";

export interface UserActivityCountInterface {
  userId: Types.ObjectId;
  totalLikes: Number,
  createdAt?: Date;
  updatedAt?: Date;
}
