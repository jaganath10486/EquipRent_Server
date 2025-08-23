import { SubCategoryInterface } from "@interfaces/category.interface";
import { Collections } from "@src/enums/collections.enum";
import { Schema, model, Document, SchemaTypes } from "mongoose";

const SubCategorySchema = new Schema<SubCategoryInterface>({
  subCategoryName: {
    requried: true,
    type: SchemaTypes.String,
  },
  isActive: {
    required: true,
    type: SchemaTypes.Boolean,
  },
  categoryId: {
    required: true,
    ref: Collections.CATGORY,
    type: SchemaTypes.ObjectId,
  },
});

const SubCategoryModel = function () {
  return model<Document>(Collections.SUBCATEGORY, SubCategorySchema);
};

export { SubCategoryModel, SubCategorySchema };
