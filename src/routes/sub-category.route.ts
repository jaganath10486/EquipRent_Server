import { Router } from "express";
import { SubCategoryController } from "@src/controllers/sub-category.controller";
import { Routes } from "@interfaces/request.interface";
import { ValidationMiddlware } from "@src/middlewares/validation.middleware";
import { CreateSubCategoryValidation } from "@validations/sub-category.validation";

export class SubCategoryRoutes implements Routes {
  public baseUrl = "/sub-category";
  public router: Router = Router();
  constructor() {
    this.initiallizeRoutes();
  }
  public initiallizeRoutes = () => {
    const subCategoryController = new SubCategoryController();
    this.router.get(
      `${this.baseUrl}/:id`,
      subCategoryController.getSubCategoryById
    );
    this.router.post(
      `${this.baseUrl}`,
      ValidationMiddlware(CreateSubCategoryValidation, 'body'),
      subCategoryController.createSubCategory
    );
  };
}
