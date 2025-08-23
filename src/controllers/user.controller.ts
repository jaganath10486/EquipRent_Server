import { IRequest } from "@interfaces/request.interface";
import { UserClass } from "@src/classes/user.class";
import HttpExceptionError from "@src/exception/httpexception";
import { UserService } from "@src/services/user.service";
import { isValidObjectId } from "@src/validations/data.validation";
import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

export class UserController {
  private userService = new UserService();
  public getUserById: (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<void> = async (req, res, next) => {
    try {
      const userId = req.params.id.toString();
      if (!userId)
        throw new HttpExceptionError(StatusCodes.BAD_REQUEST, "Id is required");
      if (!isValidObjectId(userId))
        throw new HttpExceptionError(
          StatusCodes.BAD_REQUEST,
          "Not Valid Object Id"
        );
      const userData = await this.userService.getUserById(userId);
      res.status(200).json({ data: new UserClass(userData) });
    } catch (err) {
      next(err);
    }
  };
}
