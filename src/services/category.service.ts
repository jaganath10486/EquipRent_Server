import { CategoryInterface } from "@interfaces/category.interface";
import HttpExceptionError from "@src/exception/httpexception";
import { CategoryModel } from "@src/models/category.model";
import { isValidObjectId } from "@src/validations/data.validation";
import { isEmpty } from "@utils/data.util";
import { StatusCodes } from "http-status-codes";
import { ObjectId } from "mongodb";
import { CacheService } from "./cache.service";
import { RedisKeys } from "@src/enums/redis.enum";

class CategoryService {
  private categoryModel = CategoryModel();
  private cacheService = new CacheService();
  public async isCategoryExistsByName(name: string) {
    if (isEmpty(name))
      throw new HttpExceptionError(
        StatusCodes.BAD_REQUEST,
        "Recieved empty Catergoy Name"
      );
    const categoryExists = await this.categoryModel.exists({
      categoryName: name,
    });
    return categoryExists;
  }
  public async isCategoryExistsById(id: string) {
    if (!isValidObjectId(id))
      throw new HttpExceptionError(
        StatusCodes.BAD_REQUEST,
        "Not valid Object Id"
      );
    const categoryExists = await this.categoryModel.exists({
      _id: new ObjectId(id),
    });
    return categoryExists;
  }
  public async createCategory(data: CategoryInterface) {
    if (isEmpty(data)) {
      throw new HttpExceptionError(StatusCodes.BAD_REQUEST, "Data is empty ");
    }
    const createdCategory = await this.categoryModel.create({ ...data });
    return createdCategory;
  }
  public async updateCategory(id: string, data: CategoryInterface) {
    if (isEmpty(data) || isEmpty(id)) {
      throw new HttpExceptionError(StatusCodes.BAD_REQUEST, "Data is missing");
    }
    const updatedData = await this.categoryModel.findByIdAndUpdate(
      new ObjectId(id),
      data,
      { new: true }
    );
    return updatedData;
  }
  public async getCategory(id: string) {
    if (isEmpty(id) || !isValidObjectId(id)) {
      throw new HttpExceptionError(
        StatusCodes.BAD_REQUEST,
        "Category Id is not valid"
      );
    }
    const category = await this.categoryModel.findById(new ObjectId(id));
    if (!category) {
      throw new HttpExceptionError(
        StatusCodes.NO_CONTENT,
        "No category found with the given category Id"
      );
    }
    return category;
  }
  public async getCategories(filter: Record<string, any>) {
    const cachedData = await this.cacheService.getJson(RedisKeys.CATEGORIES);
    console.log("cached data :", cachedData);
    if (!isEmpty(cachedData)) {
      return cachedData;
    }
    const categories = await this.categoryModel
      .find({ ...filter })
      .lean()
      .exec();
    await this.cacheService.setJson(RedisKeys.CATEGORIES, categories);
    return categories;
  }
}

const categoryService = new CategoryService();

export { categoryService, CategoryService };
