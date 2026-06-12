import { Router } from "express";
import {
  bulkAssignMemberRoleController,
  bulkDeactivateMembersController,
  bulkRemoveMembersController,
  deactivateMemberController,
  joinWorkspaceController,
  removeMemberController,
} from "../controllers/member.controller";
import { assignMemberRoleController } from "../controllers/role.controller";
import { writeApiRateLimiter } from "../middlewares/rateLimit.middleware";

const memberRoutes = Router();

memberRoutes.post(
  "/workspace/:inviteCode/join",
  writeApiRateLimiter,
  joinWorkspaceController
);
memberRoutes.put(
  "/workspace/:workspaceId/bulk/role",
  writeApiRateLimiter,
  bulkAssignMemberRoleController
);
memberRoutes.post(
  "/workspace/:workspaceId/bulk/deactivate",
  writeApiRateLimiter,
  bulkDeactivateMembersController
);
memberRoutes.post(
  "/workspace/:workspaceId/bulk/remove",
  writeApiRateLimiter,
  bulkRemoveMembersController
);
memberRoutes.put(
  "/workspace/:workspaceId/:memberId/role",
  writeApiRateLimiter,
  assignMemberRoleController
);
memberRoutes.patch(
  "/workspace/:workspaceId/:memberId/deactivate",
  writeApiRateLimiter,
  deactivateMemberController
);
memberRoutes.delete(
  "/workspace/:workspaceId/:memberId",
  writeApiRateLimiter,
  removeMemberController
);

export default memberRoutes;
