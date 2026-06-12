import { Router } from "express";
import {
  getAccountSummaryController,
  getCurrentUserController,
  updateEmailController,
  updatePasswordController,
  updateProfileController,
} from "../controllers/user.controller";
import { writeApiRateLimiter } from "../middlewares/rateLimit.middleware";

const userRoutes = Router();

userRoutes.get("/current", getCurrentUserController);
userRoutes.get("/account", getAccountSummaryController);
userRoutes.put("/profile", writeApiRateLimiter, updateProfileController);
userRoutes.put("/email", writeApiRateLimiter, updateEmailController);
userRoutes.put("/password", writeApiRateLimiter, updatePasswordController);

export default userRoutes;
