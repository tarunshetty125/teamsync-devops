import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { Permissions } from "../enums/role.enum";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { getMemberRoleInWorkspace } from "../services/member.service";
import {
  createMilestoneService,
  deleteMilestoneService,
  listMilestonesService,
  updateMilestoneService,
} from "../services/milestone.service";
import { buildRequestContext } from "../utils/request-context";
import { roleGuard } from "../utils/roleGuard";
import {
  createMilestoneSchema,
  milestoneIdSchema,
  updateMilestoneSchema,
} from "../validation/milestone.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

export const listMilestonesController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id?.toString();
    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const { milestones } = await listMilestonesService(workspaceId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Milestones retrieved successfully",
      milestones,
    });
  }
);

export const createMilestoneController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id?.toString();
    const body = createMilestoneSchema.parse(req.body);
    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_PROJECT]);

    const { milestone } = await createMilestoneService(
      workspaceId,
      userId,
      body,
      buildRequestContext(req, workspaceId)
    );

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Milestone created successfully",
      milestone,
    });
  }
);

export const updateMilestoneController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const milestoneId = milestoneIdSchema.parse(req.params.milestoneId);
    const body = updateMilestoneSchema.parse(req.body);
    const userId = req.user?._id?.toString();
    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_PROJECT]);

    const { milestone } = await updateMilestoneService(
      workspaceId,
      milestoneId,
      body,
      buildRequestContext(req, workspaceId)
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Milestone updated successfully",
      milestone,
    });
  }
);

export const deleteMilestoneController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const milestoneId = milestoneIdSchema.parse(req.params.milestoneId);
    const userId = req.user?._id?.toString();
    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.MANAGE_WORKSPACE_SETTINGS]);

    await deleteMilestoneService(
      workspaceId,
      milestoneId,
      userId,
      buildRequestContext(req, workspaceId)
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Milestone deleted successfully",
    });
  }
);
