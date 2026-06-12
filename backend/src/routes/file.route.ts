import { Router } from "express";
import {
  deleteFileAssetController,
  downloadFileAssetController,
  listFileAssetsForTargetController,
  previewFileAssetController,
  uploadAvatarController,
  uploadFileAssetController,
} from "../controllers/file.controller";
import { singleFileUpload } from "../middlewares/upload.middleware";
import {
  uploadRateLimiter,
  writeApiRateLimiter,
} from "../middlewares/rateLimit.middleware";

const fileRoutes = Router();

fileRoutes.post(
  "/workspace/:workspaceId/avatar",
  uploadRateLimiter,
  singleFileUpload(),
  uploadAvatarController
);

fileRoutes.post(
  "/workspace/:workspaceId/target/:targetType/:targetId",
  uploadRateLimiter,
  singleFileUpload(),
  uploadFileAssetController
);

fileRoutes.get(
  "/workspace/:workspaceId/target/:targetType/:targetId",
  listFileAssetsForTargetController
);

fileRoutes.get(
  "/workspace/:workspaceId/:fileId/preview",
  previewFileAssetController
);

fileRoutes.get(
  "/workspace/:workspaceId/:fileId/download",
  downloadFileAssetController
);

fileRoutes.delete(
  "/workspace/:workspaceId/:fileId",
  writeApiRateLimiter,
  deleteFileAssetController
);

export default fileRoutes;
