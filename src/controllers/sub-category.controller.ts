import { IRequest } from "@interfaces/request.interface";
import HttpExceptionError from "@src/exception/httpexception";
import { subCategoryService } from "@src/services/sub-category.service";
import { NextFunction, Response } from "express";

export class SubCategoryController {
  private subCategoryService = subCategoryService;
  public createSubCategory = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const payload = req.body;
      const subCategory = await this.subCategoryService.createSubCategory(
        payload
      );
      res.status(201).json({
        data: subCategory,
        message: "Sub Category created Successfully!",
      });
      return;
    } catch (err) {
      next(err);
    }
  };
  public getSubCategoryById = async (
    req: IRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const id = req.params.id;
      const subCategory = await this.subCategoryService.getSubCategoryById(id);
      res.status(200).json({ data: subCategory });
      return;
    } catch (err) {
      next(err);
    }
  };
}
