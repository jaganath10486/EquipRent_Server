import { UserRoutes } from "./user.route";
import { Router } from "express";
import { CategoryRoutes } from "./category.route";
import { SubCategoryRoutes } from "./sub-category.route";
import { EquimentRoutes } from "./equipment.route";
import { AuthRoutes } from "./auth.route";
import { EquipmentBookingRoutes } from "./equipment-booking.route";
import { TokenRoutes } from "./token.route";
import { UserActivityRoutes } from "./user-activity.route";
import { AIRoutes } from "./ai.route";
import { InsightsRoutes } from "./insights.route";
const router = Router();

const userRouter = new UserRoutes();
const equipmentBookingRouter = new EquipmentBookingRoutes();
const categoryRouter = new CategoryRoutes();
const subCategoryRouter = new SubCategoryRoutes();
const equipentRoutes = new EquimentRoutes();
const authRoutes = new AuthRoutes();
const userActivityRoutes = new UserActivityRoutes();
const tokenRoutes = new TokenRoutes();
const aiRoutes = new AIRoutes();
const insightsRoutes = new InsightsRoutes();

router.use("/equipment/bookings", equipmentBookingRouter.router);
router.use(categoryRouter.router);
router.use(subCategoryRouter.router);
router.use(equipentRoutes.router);
router.use("/user", userRouter.router);
router.use("/auth", authRoutes.router);
router.use("/token", tokenRoutes.router);
router.use("/user-activity", userActivityRoutes.router);
router.use("/ai", aiRoutes.router);
router.use("/insights", insightsRoutes.router);

export default router;
