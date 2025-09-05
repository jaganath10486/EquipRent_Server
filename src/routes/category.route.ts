import { Router } from "express";
import { Routes } from "@interfaces/request.interface";
import { CategoryController } from "@src/controllers/category.controller";

export class CategoryRoutes implements Routes {
  baseUrl = "/category";
  public router = Router();
  constructor() {
    this.initiallizeRoutes();
  }
  public initiallizeRoutes = () => {
    const categoryController = new CategoryController();
    this.router.get(`${this.baseUrl}`, categoryController.getAllCategories);
    this.router.get(`${this.baseUrl}/:id`, categoryController.getCategoryById);
    this.router.put(`${this.baseUrl}/:id`, categoryController.updateCategory);
    this.router.post(`${this.baseUrl}`, categoryController.createCategory);
  };
}
