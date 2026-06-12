import { Router } from "express";
import {
  createLabelController,
  deleteLabelController,
  listLabelsController,
  updateLabelController,
} from "../controllers/label.controller";
import { writeApiRateLimiter } from "../middlewares/rateLimit.middleware";

const labelRoutes = Router();

labelRoutes.get("/workspace/:workspaceId", listLabelsController);
labelRoutes.post(
  "/workspace/:workspaceId",
  writeApiRateLimiter,
  createLabelController
);
labelRoutes.put(
  "/workspace/:workspaceId/:labelId",
  writeApiRateLimiter,
  updateLabelController
);
labelRoutes.delete(
  "/workspace/:workspaceId/:labelId",
  writeApiRateLimiter,
  deleteLabelController
);

export default labelRoutes;
