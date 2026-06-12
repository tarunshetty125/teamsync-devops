import { Router } from "express";
import {
  listWorkspaceLoginsController,
  listWorkspaceSessionsController,
  revokeWorkspaceSessionController,
  revokeWorkspaceSessionsController,
} from "../controllers/security.controller";
import { writeApiRateLimiter } from "../middlewares/rateLimit.middleware";

const securityRoutes = Router();

securityRoutes.get("/workspace/:workspaceId/sessions", listWorkspaceSessionsController);
securityRoutes.get("/workspace/:workspaceId/logins", listWorkspaceLoginsController);
securityRoutes.delete(
  "/workspace/:workspaceId/session/:sessionId",
  writeApiRateLimiter,
  revokeWorkspaceSessionController
);
securityRoutes.delete(
  "/workspace/:workspaceId/sessions",
  writeApiRateLimiter,
  revokeWorkspaceSessionsController
);

export default securityRoutes;
