import { HashSaltRounds } from "@configs/index";
import HttpExceptionError from "@src/exception/httpexception";
import bcrypt from "bcrypt";

export const hashData = async (value: string) => {
  try {
    const hashedData = await bcrypt.hash(value, HashSaltRounds);
    return hashedData;
  } catch (err) {
    throw new HttpExceptionError(
      500,
      "Something went wrong in hashing the data"
    );
  }
};

export const compareHashData = async (
  plainValue: string,
  hashValue: string
) => {
  try {
    const match = await bcrypt.compare(plainValue, hashValue);
    return match;
  } catch (err) {
    throw new HttpExceptionError(
      500,
      "Something went wrong in comparing the hash"
    );
  }
};
