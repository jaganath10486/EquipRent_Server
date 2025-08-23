import { Model, model } from "mongoose";
import { BaseRepositoryInterface } from "@interfaces/repository.interface";

export class BaseRepository<T> implements BaseRepositoryInterface<T> {
  private model: Model<T>;
  constructor(model: Model<T>) {
    this.model = model;
  }
  getAll = async (query: any): Promise<T[]> => {
    return await this.model.find(query).exec();
  };
}
