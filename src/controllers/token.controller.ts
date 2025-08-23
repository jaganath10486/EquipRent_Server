import { TokenService } from "@src/services/token.service";
import HttpExceptionError from "@src/exception/httpexception";
import { IRequest } from "@interfaces/request.interface";
import { NextFunction, Response } from "express";

export class TokenController {
  private tokenService = new TokenService();
  refreshAccessToken = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const refreshToken = req.body.refreshToken;
      const tokens = await this.tokenService.generateAccessTokenByRefreshToken(
        refreshToken
      );
      res.status(200).json({ data: tokens });
      return;
    } catch (err) {
      next(err);
    }
  };
}
