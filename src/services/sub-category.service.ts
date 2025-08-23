import { SubCategoryInterface } from "@interfaces/category.interface";
import HttpExceptionError from "@src/exception/httpexception";
import { SubCategoryModel } from "@src/models/sub-category.model";
import { isEmpty } from "@utils/data.util";
import { categoryService } from "./category.service";
import { ObjectId } from "mongodb";
import { isValidObjectId } from "@validations/data.validation";
import { StatusCodes } from "http-status-codes";

class SubCategoryService {
  private subCategoryModel = SubCategoryModel();
  private categoryService = categoryService;

  public createSubCategory = async (
    data: SubCategoryInterface
  ): Promise<any> => {
    if (isEmpty(data) || isEmpty(data.categoryId)) {
      throw new HttpExceptionError(
        400,
        "Data is required for creating new sub category"
      );
    }
    const categoryExists = await this.categoryService.isCategoryExistsById(
      data.categoryId
    );
    if (!categoryExists) {
      throw new HttpExceptionError(400, "No Catgeory Exists");
    }
    const subCategoryExists = await this.subCategoryExists({
      subCategoryName: data.subCategoryName,
    });
    if (subCategoryExists) {
      throw new HttpExceptionError(
        400,
        "Already one sub category exists with given name"
      );
    }
    const subCategory = await this.subCategoryModel.create({
      ...data,
      categoryId: new ObjectId(data.categoryId),
    });
    return subCategory;
  };
  public subCategoryExists = async (filters: Record<string, any>) => {
    if (isEmpty(filters))
      throw new HttpExceptionError(
        400,
        "Filter Required for checking the sub category exists"
      );
    const subCategoryExists = await this.subCategoryModel.exists({
      ...filters,
    });
    return subCategoryExists;
  };
  public getSubCategoryById = async (subCategoryId: string) => {
    if (isEmpty(subCategoryId))
      throw new HttpExceptionError(400, "Sub Category ID exists");
    const subCategory = await this.subCategoryModel.findById(
      new ObjectId(subCategoryId)
    );
    return subCategory;
  };
  public async isSubCategoryExistsById(id: string) {
    if (!isValidObjectId(id))
      throw new HttpExceptionError(
        StatusCodes.BAD_REQUEST,
        "Not valid Object Id"
      );
    const subCategoryExists = await this.subCategoryModel.exists({
      _id: new ObjectId(id),
    });
    return subCategoryExists;
  }
}

const subCategoryService = new SubCategoryService();
export { subCategoryService, SubCategoryService };
