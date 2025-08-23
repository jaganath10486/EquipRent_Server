import HttpExceptionError from "@src/exception/httpexception";
import { userModel } from "@src/models/user.model";
import { UserService } from "./user.service";
import { assignorDefaultValue, isEmpty } from "@utils/data.util";
import {
  EmailLogin,
  EmailRegister,
} from "@interfaces/authentication.interface";
import { compareHashData, hashData } from "@utils/bcrypt.util";
import { TokenService } from "./token.service";
import { UserInterface } from "@interfaces/user.interface";
import { SignInProvider, UserRole } from "@src/enums/user.enum";

export class AuthService {
  private userService = new UserService();
  private tokenService = new TokenService();
  constructor() {}

  public emailVerification = async (data: EmailLogin) => {
    if (isEmpty(data)) {
      throw new HttpExceptionError(400, "Empty Creds required");
    }
    const password = data.password;
    const emailId = data.emailId;
    const userData = await this.userService.getUserData({ emailId: emailId });
    if (!userData) {
      throw new HttpExceptionError(401, "No account found with given email Id");
    }
    const matchedPassword = await compareHashData(
      password,
      assignorDefaultValue(userData.password, "")
    );
    if (!matchedPassword) {
      throw new HttpExceptionError(401, "Password is incorrect");
    }
    const tokens = this.tokenService.generateTokens(userData);
    return tokens;
  };

  public registerEmail = async (payoad: EmailRegister) => {
    if (isEmpty(payoad)) {
      throw new HttpExceptionError(400, "No Data provided for logging");
    }
    let hashedPassword = await this.hashPassword(payoad.password);
    let data: UserInterface = {
      emailId: payoad.emailId,
      fullName: payoad.fullName,
      password: hashedPassword,
      isActive: true,
      userRole: UserRole.PUBLIC,
      provider : SignInProvider.EMAIL
    };
    const userData = await this.userService.createUser(data);
    return userData;
  };

  public hashPassword = (value: string) => {
    const hashedValue = hashData(value);
    return hashedValue;
  };
}
