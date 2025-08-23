import { SignInProvider } from "@src/enums/user.enum";

export interface TokenInterface {
  mobileNumber?: number;
  emailId?: string;
  userRole: string;
  provider: SignInProvider;
  userName: string;
  userId: string;
}
