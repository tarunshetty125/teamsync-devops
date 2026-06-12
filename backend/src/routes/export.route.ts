import { Router } from "express";
import {
  createExportController,
  deleteExportController,
  downloadExportController,
  listExportsController,
} from "../controllers/export.controller";
import { exportRateLimiter } from "../middlewares/rateLimit.middleware";

const exportRoutes = Router();

exportRoutes.post(
  "/workspace/:workspaceId",
  exportRateLimiter,
  createExportController
);
exportRoutes.get("/workspace/:workspaceId", listExportsController);
exportRoutes.get("/workspace/:workspaceId/:exportId", downloadExportController);
exportRoutes.delete("/workspace/:workspaceId/:exportId", deleteExportController);

export default exportRoutes;
