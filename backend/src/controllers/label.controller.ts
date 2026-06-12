import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { Permissions } from "../enums/role.enum";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { getMemberRoleInWorkspace } from "../services/member.service";
import {
  createLabelService,
  listLabelsService,
  softDeleteLabelService,
  updateLabelService,
} from "../services/label.service";
import { roleGuard } from "../utils/roleGuard";
import { buildRequestContext } from "../utils/request-context";
import {
  createLabelSchema,
  labelIdSchema,
  listLabelsQuerySchema,
  updateLabelSchema,
} from "../validation/label.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

export const listLabelsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const query = listLabelsQuerySchema.parse(req.query);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await listLabelsService(workspaceId, query);

    return res.status(HTTPSTATUS.OK).json({
      message: "Labels fetched successfully",
      ...result,
    });
  }
);

export const createLabelController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = createLabelSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_TASK]);

    const { label } = await createLabelService(
      buildRequestContext(req, workspaceId),
      body
    );

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Label created successfully",
      label,
    });
  }
);

export const updateLabelController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const labelId = labelIdSchema.parse(req.params.labelId);
    const body = updateLabelSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.MANAGE_WORKSPACE_SETTINGS]);

    const { label } = await updateLabelService(
      buildRequestContext(req, workspaceId),
      labelId,
      body
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Label updated successfully",
      label,
    });
  }
);

export const deleteLabelController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const labelId = labelIdSchema.parse(req.params.labelId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.MANAGE_WORKSPACE_SETTINGS]);

    await softDeleteLabelService(buildRequestContext(req, workspaceId), labelId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Label deleted successfully",
    });
  }
);
