import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { Permissions } from "../enums/role.enum";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { getMemberRoleInWorkspace } from "../services/member.service";
import {
  canViewExecutiveDashboard,
  getExecutiveDashboardService,
  getPersonalDashboardService,
  getTeamDashboardService,
} from "../services/dashboard.service";
import { ForbiddenException } from "../utils/appError";
import { roleGuard } from "../utils/roleGuard";
import { dashboardRangeSchema } from "../validation/dashboard.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

export const getPersonalDashboardController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id?.toString();
    const { range } = dashboardRangeSchema.parse(req.query);

    await getMemberRoleInWorkspace(userId, workspaceId);
    const dashboard = await getPersonalDashboardService(
      workspaceId,
      userId,
      range
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Personal dashboard retrieved successfully",
      dashboard,
    });
  }
);

export const getTeamDashboardController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id?.toString();
    const { range } = dashboardRangeSchema.parse(req.query);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const dashboard = await getTeamDashboardService(workspaceId, userId, range);

    return res.status(HTTPSTATUS.OK).json({
      message: "Team dashboard retrieved successfully",
      dashboard,
    });
  }
);

export const getExecutiveDashboardController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id?.toString();
    const { range } = dashboardRangeSchema.parse(req.query);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);

    if (!canViewExecutiveDashboard(role)) {
      throw new ForbiddenException(
        "Only workspace owners and admins can view the executive dashboard"
      );
    }

    const dashboard = await getExecutiveDashboardService(
      workspaceId,
      userId,
      range
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Executive dashboard retrieved successfully",
      dashboard,
    });
  }
);
