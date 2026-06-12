import { Router } from "express";
import {
  searchWorkspacePreviewController,
  searchWorkspaceTypeController,
} from "../controllers/search.controller";
import { searchRateLimiter } from "../middlewares/rateLimit.middleware";

const searchRoutes = Router();

searchRoutes.get(
  "/workspace/:workspaceId",
  searchRateLimiter,
  searchWorkspacePreviewController
);
searchRoutes.get(
  "/workspace/:workspaceId/type/:type",
  searchRateLimiter,
  searchWorkspaceTypeController
);

export default searchRoutes;
