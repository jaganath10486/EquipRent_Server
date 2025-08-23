import { Express } from "express";

export interface AppInterface {
  app: Express;
  initiallizerMiddlewares: () => void;
}
