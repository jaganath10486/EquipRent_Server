import HttpExceptionError from "@src/exception/httpexception";
import jwt from "jsonwebtoken";
import { JWT_SECRETE_KEY } from "@configs/environment";
const secrete_key = JWT_SECRETE_KEY || "";

export const signJWTToken = (
  payload: Record<string, any>,
  expiryInSec: number
) => {
  console.log("secrete_key :", secrete_key);
  const expirationInSeconds = !isNaN(expiryInSec) ? expiryInSec : 1 * 60 * 60;
  payload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expirationInSeconds,
  };
  let token = jwt.sign(payload, secrete_key);
  return token;
};

export const veirfyJWTToken = (token: string): any => {
  try {
    const decoded = jwt.verify(token, secrete_key);
    if (!decoded) {
      throw new HttpExceptionError(401, "Not valid token");
    }
    return decoded;
  } catch (err) {
    throw new HttpExceptionError(401, "Not valid jwt");
  }
};
