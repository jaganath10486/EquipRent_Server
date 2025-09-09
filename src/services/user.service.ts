import { userModel } from "@src/models/user.model";
import { isValidObjectId } from "@src/validations/data.validation";
import { ObjectId } from "mongodb";
import HttpExceptionError from "@src/exception/httpexception";
import { StatusCodes } from "http-status-codes";
import { UserInterface } from "@interfaces/user.interface";
import { UserRole } from "@src/enums/user.enum";
export class UserService {
  private userModel = userModel();

  public async getUserById(userId: any) {
    if (!isValidObjectId(userId)) {
      throw new HttpExceptionError(
        StatusCodes.BAD_REQUEST,
        "Not valid Object Id"
      );
    }
    const user = await this.userModel.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      throw new HttpExceptionError(StatusCodes.NO_CONTENT, "No User Find");
    }
    return user;
  }

  public async getUserData(
    filter: Record<string, string>
  ): Promise<UserInterface | null> {
    const data = await this.userModel
      .findOne({ ...filter })
      .lean()
      .exec();
    return data;
  }

  public async isUserExists(filter: Record<string, any>) {
    const isUserExist = await this.userModel.exists({ ...filter });
    return isUserExist;
  }

  public async createUser(payload: UserInterface) {
    if (!payload) {
      throw new HttpExceptionError(
        StatusCodes.BAD_REQUEST,
        "Not valid User Data"
      );
    }
    let userData = payload;
    if (!payload.userRole) {
      userData.userRole = UserRole.USER;
    }
    const user = await this.userModel.create({ ...payload });
    return user;
  }
}
