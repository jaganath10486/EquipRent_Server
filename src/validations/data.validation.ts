import { Types } from "mongoose";

export const isValidObjectId = (id: any) => {
  if (Types.ObjectId.isValid(id)) {
    return true;
  } else {
    return false;
  }
};
