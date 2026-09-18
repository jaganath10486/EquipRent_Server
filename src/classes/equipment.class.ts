import { Asset, EquipmentInterface } from "@interfaces/equipment.interface";
import { assignorDefaultValue, isEmpty } from "@utils/data.util";
import { UserIdClass } from "./user.class";
import { CategoryIdClass, SubCategoryIdClass } from "./category.class";

export class EquipmentClass {
  id: string;
  owner?: Object;
  totalQuantity?: number;
  category: Object;
  subCategory: Object;
  name?: string;
  assets: Asset[];
  description?: string;
  specifications?: Object;
  isFeatured?: boolean;
  tags?: string[];
  depoists?: Object;
  prices?: object;
  userActivity?: {
    isLiked?: boolean;
  };
  constructor(data: any) {
    this.id = assignorDefaultValue(data._id, "");
    // `avilableQuanitity` was declared on this class and never assigned, so the
    // client was never told how many units exist. Stock now comes from
    // totalQuantity, with live availability served by the availability endpoint.
    this.totalQuantity = Number(data.totalQuantity) || 1;
    if (data.userId && typeof data.userId === "object") {
      this.owner = new UserIdClass(data.userId);
    }
    this.category = new CategoryIdClass(data.categoryId);
    this.subCategory = new SubCategoryIdClass(data.subCategoryId);
    this.name = assignorDefaultValue(data.name, "");
    this.description = assignorDefaultValue(data.description, "");
    if (data.tags) {
      this.tags = data.tags;
    }
    this.isFeatured = assignorDefaultValue(data.isFeatured, false);
    this.assets = data.assets;
    if (data.deposits) {
      this.depoists = data.deposits;
    }
    if (data.prices) {
      this.prices = data.prices;
    }
    this.userActivity = {
      isLiked: assignorDefaultValue(data?.isLiked, false),
    };
    if (!isEmpty(data?.specifications || {})) {
      this.specifications = data.specifications;
    }
  }
}
