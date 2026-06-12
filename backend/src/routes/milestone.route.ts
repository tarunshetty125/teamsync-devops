import { Router } from "express";
import {
  createMilestoneController,
  deleteMilestoneController,
  listMilestonesController,
  updateMilestoneController,
} from "../controllers/milestone.controller";
import { writeApiRateLimiter } from "../middlewares/rateLimit.middleware";

const milestoneRoutes = Router();

milestoneRoutes.get("/workspace/:workspaceId", listMilestonesController);
milestoneRoutes.post(
  "/workspace/:workspaceId",
  writeApiRateLimiter,
  createMilestoneController
);
milestoneRoutes.put(
  "/workspace/:workspaceId/:milestoneId",
  writeApiRateLimiter,
  updateMilestoneController
);
milestoneRoutes.delete(
  "/workspace/:workspaceId/:milestoneId",
  writeApiRateLimiter,
  deleteMilestoneController
);

export default milestoneRoutes;
