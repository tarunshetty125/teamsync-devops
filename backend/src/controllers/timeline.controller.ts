import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { Permissions } from "../enums/role.enum";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { getMemberRoleInWorkspace } from "../services/member.service";
import { getTimelineService } from "../services/timeline.service";
import { roleGuard } from "../utils/roleGuard";
import { timelineQuerySchema } from "../validation/timeline.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

export const getTimelineController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const query = timelineQuerySchema.parse(req.query);
    const userId = req.user?._id?.toString();
    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const timeline = await getTimelineService(workspaceId, query);

    return res.status(HTTPSTATUS.OK).json({
      message: "Timeline retrieved successfully",
      timeline,
    });
  }
);
