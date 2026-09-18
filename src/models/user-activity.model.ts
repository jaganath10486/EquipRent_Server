import { model, Schema, SchemaTypes, Document } from "mongoose";
import { UserActivityInterface } from "@interfaces/user-activity.interface";
import {
  UserActivity,
  UserActivityReference,
} from "@src/enums/user-activity.enum";
import { Collections } from "@src/enums/collections.enum";

const UserActivitySchema: Schema<UserActivityInterface & Document> = new Schema<
  UserActivityInterface & Document
>(
  {
  sourceId: {
    type: SchemaTypes.ObjectId,
    required: true,
  },
  userId: {
    type: SchemaTypes.ObjectId,
    required: true,
  },
  action: {
    type: SchemaTypes.String,
    enum: UserActivity,
    required: true,
  },
  reference: {
    type: SchemaTypes.String,
    enum: UserActivityReference,
    required: true,
  },
  isPositive: {
    enum : [1,0],
    type: SchemaTypes.Number,
    required: false,
    default: 0,
  },
  },
  // The interface always declared createdAt/updatedAt but the schema never
  // enabled them, so there was no way to tell a like from last year from one
  // made a minute ago.
  { timestamps: true }
);

UserActivitySchema.index({ userId: 1, action: 1, isPositive: 1, updatedAt: -1 });

export const UserActivityModel = () => {
  return model<UserActivityInterface & Document>(
    Collections.USERACTIVITY,
    UserActivitySchema
  );
};
