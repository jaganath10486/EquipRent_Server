import { model, Schema, SchemaTypes, Document } from "mongoose";
import { UserActivityCountInterface } from "@interfaces/user-activity-count.interface";
import { Collections } from "@src/enums/collections.enum";

const UserActivityCountSchema: Schema<UserActivityCountInterface & Document> =
  new Schema<UserActivityCountInterface & Document>({
    userId: {
      type: SchemaTypes.ObjectId,
      required: true,
      unique: true,
    },
    totalLikes: {
      type: SchemaTypes.Number,
      default: 0,
      min: 0,
    },
  });

UserActivityCountSchema.index({ userId: 1 });

export const UserActivityCountModel = () => {
  return model<UserActivityCountInterface & Document>(
    Collections.USERACTIVITYCOUNT,
    UserActivityCountSchema
  );
};
