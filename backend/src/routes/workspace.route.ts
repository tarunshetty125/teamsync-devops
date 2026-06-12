import { Router } from "express";
import {
  changeWorkspaceMemberRoleController,
  createWorkspaceController,
  deleteWorkspaceByIdController,
  getAllWorkspacesUserIsMemberController,
  getWorkspaceAnalyticsController,
  getWorkspaceByIdController,
  getWorkspaceMembersController,
  updateWorkspaceByIdController,
} from "../controllers/workspace.controller";
import { writeApiRateLimiter } from "../middlewares/rateLimit.middleware";

const workspaceRoutes = Router();

workspaceRoutes.post(
  "/create/new",
  writeApiRateLimiter,
  createWorkspaceController
);
workspaceRoutes.put(
  "/update/:id",
  writeApiRateLimiter,
  updateWorkspaceByIdController
);

workspaceRoutes.put(
  "/change/member/role/:id",
  writeApiRateLimiter,
  changeWorkspaceMemberRoleController
);

workspaceRoutes.delete(
  "/delete/:id",
  writeApiRateLimiter,
  deleteWorkspaceByIdController
);

workspaceRoutes.get("/all", getAllWorkspacesUserIsMemberController);

workspaceRoutes.get("/members/:id", getWorkspaceMembersController);
workspaceRoutes.get("/analytics/:id", getWorkspaceAnalyticsController);

workspaceRoutes.get("/:id", getWorkspaceByIdController);

export default workspaceRoutes;
