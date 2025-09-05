import { Types } from "mongoose";

export interface UserActivityCountInterface {
  userId: Types.ObjectId;
  totalLikes: Number,
  createdAt?: Date; // better as Date
  updatedAt?: Date;
}
