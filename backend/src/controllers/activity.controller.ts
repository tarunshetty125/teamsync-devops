import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { Permissions } from "../enums/role.enum";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { getActivityFeedService } from "../services/activity-feed.service";
import { getMemberRoleInWorkspace } from "../services/member.service";
import { roleGuard } from "../utils/roleGuard";
import { activityFeedQuerySchema } from "../validation/activity.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

export const getActivityFeedController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const query = activityFeedQuerySchema.parse(req.query);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await getActivityFeedService(
      workspaceId,
      {
        targetType: query.targetType,
        targetId: query.targetId,
      },
      {
        pageSize: query.pageSize,
        pageNumber: query.pageNumber,
      }
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Activity feed fetched successfully",
      ...result,
    });
  }
);
