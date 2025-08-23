import { UserInterface } from "@interfaces/user.interface";
import { SignInProvider, UserRole } from "@src/enums/user.enum";
import { assignorDefaultValue } from "@utils/data.util";

export class UserClass {
  userId: string;
  userName?: string;
  avatorUrl?: string;
  userRole: string;
  fullName: string;
  address?: string;
  provider: string;
  isActive?: boolean;
  constructor(user: UserInterface) {
    this.userId = assignorDefaultValue(user._id, "");
    this.isActive = assignorDefaultValue(user.isActive, true);
    this.userName = assignorDefaultValue(user.userName, "");
    this.userRole = assignorDefaultValue(user.userRole, UserRole.PUBLIC);
    this.fullName = assignorDefaultValue(user.fullName, "");
    this.provider = assignorDefaultValue(user.provider, SignInProvider.EMAIL);
    this.address = user.address && user.address;
    this.avatorUrl = user.avatorUrl && user.avatorUrl;
  }
}

export class UserIdClass {
  userId: string;
  userName: string;
  avatorUrl: string;
  userRole: Object;
  constructor(data: any) {
    this.userId = data._id;
    this.userName = data.userName;
    this.avatorUrl = data.avatorUrl;
    this.userRole = data.userRole;
  }
}
