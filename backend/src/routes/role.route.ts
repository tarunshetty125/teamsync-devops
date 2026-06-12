import { Router } from "express";
import {
  createRoleController,
  deleteRoleController,
  listRolesController,
  updateRoleController,
} from "../controllers/role.controller";
import { writeApiRateLimiter } from "../middlewares/rateLimit.middleware";

const roleRoutes = Router();

roleRoutes.get("/workspace/:workspaceId", listRolesController);
roleRoutes.post(
  "/workspace/:workspaceId",
  writeApiRateLimiter,
  createRoleController
);
roleRoutes.put(
  "/workspace/:workspaceId/:roleId",
  writeApiRateLimiter,
  updateRoleController
);
roleRoutes.delete(
  "/workspace/:workspaceId/:roleId",
  writeApiRateLimiter,
  deleteRoleController
);

export default roleRoutes;
