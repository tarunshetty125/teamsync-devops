import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { Permissions } from "../enums/role.enum";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { getGanttService } from "../services/gantt.service";
import { getMemberRoleInWorkspace } from "../services/member.service";
import { roleGuard } from "../utils/roleGuard";
import { ganttQuerySchema } from "../validation/gantt.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

export const getGanttController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const query = ganttQuerySchema.parse(req.query);
    const userId = req.user?._id?.toString();
    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const gantt = await getGanttService(workspaceId, query);

    return res.status(HTTPSTATUS.OK).json({
      message: "Gantt retrieved successfully",
      gantt,
    });
  }
);
