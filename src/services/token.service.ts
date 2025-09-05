import { UserInterface } from "@interfaces/user.interface";
import HttpExceptionError from "@src/exception/httpexception";
import { signJWTToken, veirfyJWTToken } from "@utils/jwt.util";
import { access } from "fs";
import { UserService } from "./user.service";
import { isEmpty } from "@utils/data.util";
import { UserRole } from "@src/enums/user.enum";
import { TokenInterface } from "@interfaces/token.interfacs";

export class TokenService {
  constructor() {}
  private userService = new UserService();
  createAccessTokenPayload = (data: UserInterface) => {
    let payload = {
      userId: data._id,
      userName: data.userName,
      provider: data.provider,
      userRole: data.userRole,
      ...(data.emailId ? { emailId: data.emailId } : {}),
      ...(data.mobileNumber ? { mobileNumber: data.mobileNumber } : {}),
    };
    return payload;
  };

  generateRefreshToken = (userId: string) => {
    const payload = {
      userId: userId,
    };
    const token = signJWTToken(payload, 864000);
    return token;
  };

  generateAccessToken = (data: UserInterface) => {
    const payload = this.createAccessTokenPayload(data);
    const token = signJWTToken(payload, 3600);
    return token;
  };

  generateTokens = async (data: UserInterface) => {
    const accessToken = this.generateAccessToken(data);
    const refreshToken = this.generateRefreshToken(String(data._id || ""));
    return { accessToken, refreshToken };
  };

  generateAccessTokenByRefreshToken = async (refreshToken: string) => {
    if (isEmpty(refreshToken)) {
      throw new HttpExceptionError(401, "Refrssh token is empty");
    }
    const data: TokenInterface = await veirfyJWTToken(refreshToken);
    if (!data.userId) {
      throw new HttpExceptionError(400, "No User Id is found");
    }
    const userData = await this.userService.getUserById(data.userId);
    const accessToken = this.generateAccessToken(userData);
    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
    };
    // const userData = await this.userService.getUserById(data.userId)
    if (!data) {
      throw new HttpExceptionError(401, "Failed to veirfy the token");
    }
  };
}
