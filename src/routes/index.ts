import { UserRoutes } from "./user.route";
import { Router } from "express";
import { CategoryRoutes } from "./category.route";
import { SubCategoryRoutes } from "./sub-category.route";
import { EquimentRoutes } from "./equipment.route";
import { AuthRoutes } from "./auth.route";
import { EquipmentBookingRoutes } from "./equipment-booking.route";
import { TokenRoutes } from "./token.route";
const router = Router();

const userRouter = new UserRoutes();
const equipmentBookingRouter = new EquipmentBookingRoutes();
const categoryRouter = new CategoryRoutes();
const subCategoryRouter = new SubCategoryRoutes();
const equipentRoutes = new EquimentRoutes();
const authRoutes = new AuthRoutes();
const tokenRoutes = new TokenRoutes();

router.use("/equipment/bookings", equipmentBookingRouter.router);
router.use(categoryRouter.router);
router.use(subCategoryRouter.router);
router.use(equipentRoutes.router);
router.use('/user',userRouter.router);
router.use("/auth", authRoutes.router);
router.use("/token", tokenRoutes.router);

export default router;
