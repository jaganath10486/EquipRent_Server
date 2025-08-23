import { UserInterface } from "@interfaces/user.interface";
import { UserRole } from "@src/enums/user.enum";
import { Schema, SchemaTypes, model, Document } from "mongoose";

const userSchema: Schema = new Schema(
  {
    fullName: {
      type: SchemaTypes.String,
      required: false,
    },
    userName: {
      type: SchemaTypes.String,
      required: false,
    },
    mobileNumber: {
      type: SchemaTypes.Number,
      required: false,
    },
    emailId: {
      type: SchemaTypes.String,
      required: false,
    },
    avatorUrl: {
      type: SchemaTypes.String,
      required: false,
    },
    isActive: {
      type: SchemaTypes.Boolean,
      required: true,
    },
    createdBy: {
      type: SchemaTypes.String,
      required: false,
    },
    modifiedBy: {
      type: SchemaTypes.String,
      required: false,
    },
    address: {
      type: SchemaTypes.String,
      required: false,
    },
    dateOfBirth: {
      type: SchemaTypes.Date,
      required: false,
    },
    userRole: {
      type: SchemaTypes.String,
      enum: UserRole,
      required: true,
    },
    password: {
      type: SchemaTypes.String,
      required: false,
    },
    signInProvider: {},
  },
  {
    timestamps: true,
  }
);

userSchema.index({ firstName: 1 });

export const userModel = () => {
  return model<UserInterface & Document>("user", userSchema);
};
