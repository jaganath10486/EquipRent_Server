import express, { Express, Router } from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import hpp from "hpp";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { connect, set } from "mongoose";
import { MongoDbAccessConfig, PORT } from "@configs/environment";
import MongoDB from "./databse";
import router from "./routes";
import { ErrorMiddleware } from "./middlewares/error.middleware";
import { ResponseModifier } from "./middlewares/responseModifier.middleware";
import { AuthMiddleware } from "./middlewares/auth.middleware";

class App {
  private server: unknown;
  private app: Express;
  constructor() {
    this.app = express();
    this.connectToDB();
    this.initiallizeRateLimiter();
    this.initiallizeResponseModifierMiddleware();
    this.initiallizeMiddleware();
    this.initiallizeRoutes(router);
    this.initiallizeErrorMiddleware();
  }
  public initiallizeMiddleware() {
    this.app.use(morgan("combined"));
    this.app.use(helmet());
    this.app.use(cors({ origin: true }));
    this.app.use(express.json());
    this.app.use(cookieParser());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(hpp());
    this.app.use(compression());
    this.app.use(AuthMiddleware())
  }
  public async connectToDB() {
    try {
      connect(MongoDbAccessConfig.url, {})
        .then(() => {
          console.log("Successfully connected to mongo db ");
        })
        .catch(() => {
          console.error("Error in conntecting to mongo db");
        });
      // mongodb.
    } catch (err) {
      console.log("err :", err);
    }
  }
  public initiallizeRateLimiter() {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
    });
    // this.app.use(limiter);
  }
  public initiallizeServer() {
    this.server = this.app.listen(PORT, () => {
      console.log(`server listening on ${PORT}`);
    });
  }
  public initiallizeRoutes(routes: Router) {
    this.app.use("/api", routes);
  }
  public initiallizeResponseModifierMiddleware() {
    this.app.use(ResponseModifier);
  }
  public initiallizeErrorMiddleware() {
    this.app.use(ErrorMiddleware);
  }
}
export default App;
