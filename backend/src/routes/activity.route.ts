import { Router } from "express";
import { getActivityFeedController } from "../controllers/activity.controller";

const activityRoutes = Router();

activityRoutes.get("/workspace/:workspaceId", getActivityFeedController);

export default activityRoutes;
