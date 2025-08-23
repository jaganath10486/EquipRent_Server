import { CategoryInterface } from "@interfaces/category.interface";
import { Collections } from "@src/enums/collections.enum";
import { Schema, Model, SchemaType, SchemaTypes, model } from "mongoose";

const CategorySchema = new Schema({
  categoryName: {
    type: SchemaTypes.String,
    required: true,
  },
  isActive: {
    required: true,
    type: SchemaTypes.Boolean,
  },
  logoUrl: {
    required: false,
    type: SchemaTypes.String,
  },
});

CategorySchema.index({ categoryName: 1 });

const CategoryModel = function () {
  return model<CategoryInterface & Document>(
    Collections.CATGORY,
    CategorySchema
  );
};

export { CategoryModel, CategorySchema };
