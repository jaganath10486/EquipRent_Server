import { MediaType } from "@src/enums/assets.enum";
import { Types } from "mongoose";

export interface EquipmentInterface {
  _id?: Types.ObjectId;
  categoryId: Types.ObjectId;
  subCategoryId: Types.ObjectId;
  name?: string;
  description?: string;
  totalQuantity?: number;
  avilableQuantity?: number;
  assets: Asset[];
  userId: Types.ObjectId;
  prices?: {
    dailyRent?: number;
  };
  deposits?: {
    dailyDeposit?: number;
  };
  isActive?: boolean;
  specifications?: Record<string, string>;
  tags?: string[];
  isFeatured?: boolean;
}

export interface Asset {
  mediaType: MediaType;
  url: string;
  thumbnail_url?: string;
}
