import { EquipmentInterface } from "@interfaces/equipment.interface";
import { MediaType } from "@src/enums/assets.enum";
import { Collections } from "@src/enums/collections.enum";
import mongoose, {
  Schema,
  Model,
  SchemaTypes,
  SchemaType,
  model,
} from "mongoose";

const AssetSchema = new Schema({
  url: {
    type: SchemaTypes.String,
    required: true,
  },
  mediaType: {
    type: SchemaTypes.String,
    enum: Object.values(MediaType),
    required: true,
  },
  thumbnail_url: {
    type: SchemaTypes.String,
    required: false,
  },
});

const EquipmentSchema = new Schema(
  {
    categoryId: {
      type: SchemaTypes.ObjectId,
      ref: Collections.CATGORY,
      required: true,
    },
    subCategoryId: {
      type: SchemaTypes.ObjectId,
      ref: Collections.SUBCATEGORY,
      required: true,
    },
    name: {
      type: SchemaTypes.String,
      required: true,
    },
    totalQuantity: {
      type: SchemaTypes.Number,
      required: true,
    },
    userId: {
      type: SchemaTypes.ObjectId,
      required: false,
      ref: Collections.USER,
    },
    avilableQuanitity: {
      type: SchemaTypes.Number,
      required: false,
    },
    assets: [AssetSchema],
    description: {
      type: SchemaTypes.String,
      required: true,
    },
    prices: {
      _id: false,
      dailyRent: {
        type: SchemaTypes.Number,
        required: true,
        min: 1,
      },
    },
    deposits: {
      _id: false,
      dailyDeposit: {
        type: SchemaTypes.Number,
        required: false,
        min: 1,
      },
    },
    isActive: {
      type: SchemaTypes.Boolean,
      required: true,
    },

    specifications: {
      type: SchemaTypes.Map,
      of: String,
      default: {},
    },

    isFeatured: {
      type: SchemaTypes.Boolean,
      required: false,
      default: false,
    },
    tags: {
      type: [SchemaTypes.String],
      default: [],
      required: false,
    },
  },
  { timestamps: true }
);

const EquipmentModel = function () {
  return model<EquipmentInterface & Document>(
    Collections.EQUIPMENT,
    EquipmentSchema
  );
};

export { EquipmentModel, EquipmentSchema };
