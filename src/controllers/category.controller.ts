import { IRequest } from "@interfaces/request.interface";
import HttpExceptionError from "@src/exception/httpexception";
import { categoryService } from "@src/services/category.service";
import { assignorDefaultValue, isEmpty } from "@utils/data.util";
import { NextFunction, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { isValidObjectId } from "@validations/data.validation";
import { CategoryInterface } from "@interfaces/category.interface";

class CategoryController {
  private categoryService = categoryService;
  public getCategoryById = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const id = req.params.id.toString();
      if (isEmpty(id) || !isValidObjectId(id)) {
        throw new HttpExceptionError(StatusCodes.BAD_REQUEST, "Not valid Id");
      }
      const category = await this.categoryService.getCategory(id);
      res.status(200).json({ data: category });
    } catch (err) {
      next(err);
    }
  };
  public getAllCategories = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const category = await this.categoryService.getCategories({});
      res
        .status(200)
        .json({
          data: category,
          skipResponseModifier: false,
          message: "Fetched all the categories",
        });
    } catch (err) {
      next(err);
    }
  };
  public formCreateCategoryData(data: any): CategoryInterface {
    const categoryData: CategoryInterface = {
      categoryName: data.categoryName,
      isActive: assignorDefaultValue(data.isActive, true),
      logoUrl: assignorDefaultValue(data.logoUrl, ""),
    };
    return categoryData;
  }
  public createCategory = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const payload = req.body;
      console.log("payload :", payload);
      if (isEmpty(payload)) {
        throw new HttpExceptionError(
          StatusCodes.BAD_REQUEST,
          "Category data is required"
        );
      }
      console.log("payload :", payload);
      const data = this.formCreateCategoryData(payload);
      const categoryData = await this.categoryService.createCategory(data);
      console.log("categ :", categoryData);
      res
        .status(201)
        .json({ data: categoryData, message: "Successfully created category" });
      return;
    } catch (err) {
      next(err);
    }
  };
  public updateCategory = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const payload = req.body;
      const id = req.params.id.toString();
      if (isEmpty(payload) || isEmpty(id)) {
        throw new HttpExceptionError(
          StatusCodes.BAD_REQUEST,
          "Payload or category id is required to update"
        );
      }
      const data = this.formUpdateCategoryData(payload);
      const updatedCategory = await this.categoryService.updateCategory(
        id,
        data
      );
      res.status(200).json({
        data: updatedCategory,
        message: "Successfully updated the category data",
      });
      return;
    } catch (err) {
      next(err);
    }
  };
  public formUpdateCategoryData(data: any): any {
    let payload: Record<string, any> = {};
    if (data.categoryName != undefined) {
      payload["categoryName"] = data.categoryName;
    }
    if (data.logoUrl != undefined) {
      payload["logoUrl"] = data.logoUrl;
    }
    return payload;
  }
}

export { CategoryController };
