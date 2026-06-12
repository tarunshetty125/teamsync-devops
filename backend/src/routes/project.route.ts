import { Router } from "express";
import {
  createProjectController,
  deleteProjectController,
  getAllProjectsInWorkspaceController,
  getProjectAnalyticsController,
  getProjectByIdAndWorkspaceIdController,
  updateProjectController,
} from "../controllers/project.controller";
import { writeApiRateLimiter } from "../middlewares/rateLimit.middleware";

const projectRoutes = Router();

projectRoutes.post(
  "/workspace/:workspaceId/create",
  writeApiRateLimiter,
  createProjectController
);

projectRoutes.put(
  "/:id/workspace/:workspaceId/update",
  writeApiRateLimiter,
  updateProjectController
);

projectRoutes.delete(
  "/:id/workspace/:workspaceId/delete",
  writeApiRateLimiter,
  deleteProjectController
);

projectRoutes.get(
  "/workspace/:workspaceId/all",
  getAllProjectsInWorkspaceController
);

projectRoutes.get(
  "/:id/workspace/:workspaceId/analytics",
  getProjectAnalyticsController
);

projectRoutes.get(
  "/:id/workspace/:workspaceId",
  getProjectByIdAndWorkspaceIdController
);

export default projectRoutes;
