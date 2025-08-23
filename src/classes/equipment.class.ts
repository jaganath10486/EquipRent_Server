import { Asset, EquipmentInterface } from "@interfaces/equipment.interface";
import { assignorDefaultValue, isEmpty } from "@utils/data.util";
import { UserIdClass } from "./user.class";
import { CategoryIdClass, SubCategoryIdClass } from "./category.class";

export class EquipmentClass {
  id: string;
  // user: Object;
  category: Object;
  subCategory: Object;
  name?: string;
  avilableQuanitity?: number;
  assets: Asset[];
  description?: string;
  specifications?: Object;
  isFeatured?: boolean;
  tags?: string[];
  depoists?: Object;
  prices?: object;
  constructor(data: any) {
    this.id = assignorDefaultValue(data._id, "");
    // this.user = new UserIdClass(data?.userId);
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
    if (!isEmpty(data?.specifications || {})) {
      this.specifications = data.specifications;
    }
  }
}
