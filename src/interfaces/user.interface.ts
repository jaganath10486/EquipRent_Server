import { SignInProvider, UserRole } from "@src/enums/user.enum";
import { ObjectId } from "mongoose";

export interface UserInterface {
  _id?: ObjectId;
  fullName?: string;
  userName?: string;
  mobileNumber?: number;
  emailId?: string;
  avatorUrl?: string;
  isActive: boolean;
  createdBy?: string;
  modifiedBy?: string;
  address?: string;
  provider?: SignInProvider;
  password?: string;
  userRole?: UserRole;
}
