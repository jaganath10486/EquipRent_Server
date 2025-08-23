import { IRequest } from "@interfaces/request.interface";
import { Response, NextFunction } from "express";
import { AuthService } from "@src/services/auth.service";

export class AuthController {
  private authService = new AuthService();
  public veirfyEmail = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const payload = req.body;
      const tokens = await this.authService.emailVerification(payload);
      res.status(200).json({ data: tokens, message: "Logged In Successfully" });
      return;
    } catch (err) {
      next(err);
    }
  };
  public registerEmail = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const payload = req.body;
      const userData = await this.authService.registerEmail(payload);
      res.status(201).json({
        data: userData,
        message:
          "Account created , please use the regsiterd email to login to your account",
      });
      return;
    } catch (err) {
      next(err);
    }
  };
}
