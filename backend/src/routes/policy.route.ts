import { Router } from "express";
import {
  getWorkspacePolicyController,
  updateWorkspacePolicyController,
} from "../controllers/policy.controller";
import { writeApiRateLimiter } from "../middlewares/rateLimit.middleware";

const policyRoutes = Router();

policyRoutes.get("/workspace/:workspaceId", getWorkspacePolicyController);
policyRoutes.put(
  "/workspace/:workspaceId",
  writeApiRateLimiter,
  updateWorkspacePolicyController
);

export default policyRoutes;
