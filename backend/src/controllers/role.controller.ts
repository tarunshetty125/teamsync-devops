import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import {
  assignMemberRoleService,
  createRoleService,
  deleteRoleService,
  listRolesService,
  updateRoleService,
} from "../services/role.service";
import { buildRequestContext } from "../utils/request-context";
import {
  memberIdSchema,
  roleAssignmentSchema,
  roleIdSchema,
  rolePayloadSchema,
} from "../validation/governance.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

export const listRolesController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id?.toString();
    const result = await listRolesService(workspaceId, userId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Roles retrieved successfully",
      ...result,
    });
  }
);

export const createRoleController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = rolePayloadSchema.parse(req.body);
    const context = buildRequestContext(req, workspaceId);
    const result = await createRoleService(context, body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Role created successfully",
      ...result,
    });
  }
);

export const updateRoleController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const roleId = roleIdSchema.parse(req.params.roleId);
    const body = rolePayloadSchema.parse(req.body);
    const context = buildRequestContext(req, workspaceId);
    const result = await updateRoleService(context, roleId, body);

    return res.status(HTTPSTATUS.OK).json({
      message: "Role updated successfully",
      ...result,
    });
  }
);

export const deleteRoleController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const roleId = roleIdSchema.parse(req.params.roleId);
    const context = buildRequestContext(req, workspaceId);

    await deleteRoleService(context, roleId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Role deleted successfully",
    });
  }
);

export const assignMemberRoleController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const memberId = memberIdSchema.parse(req.params.memberId);
    const { roleId } = roleAssignmentSchema.parse(req.body);
    const context = buildRequestContext(req, workspaceId);
    const result = await assignMemberRoleService(context, memberId, roleId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Member role updated successfully",
      ...result,
    });
  }
);
