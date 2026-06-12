import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { Permissions } from "../enums/role.enum";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { getMemberRoleInWorkspace } from "../services/member.service";
import {
  searchWorkspacePreviewService,
  searchWorkspaceTypeService,
} from "../services/search.service";
import { roleGuard } from "../utils/roleGuard";
import {
  searchQuerySchema,
  searchTypeParamSchema,
  searchTypeQuerySchema,
} from "../validation/search.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

export const searchWorkspacePreviewController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const query = searchQuerySchema.parse(req.query);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await searchWorkspacePreviewService(
      workspaceId,
      query.q,
      query.types,
      query.limitPerType
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Search results fetched successfully",
      ...result,
    });
  }
);

export const searchWorkspaceTypeController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const type = searchTypeParamSchema.parse(req.params.type);
    const query = searchTypeQuerySchema.parse(req.query);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await searchWorkspaceTypeService(
      workspaceId,
      type,
      query.q,
      query.pageSize,
      query.pageNumber
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Search results fetched successfully",
      ...result,
    });
  }
);
