import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { listAuditLogsService } from "../services/audit-center.service";
import { auditQuerySchema } from "../validation/governance.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

export const listAuditLogsController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id?.toString();
    const filters = auditQuerySchema.parse(req.query);

    const result = await listAuditLogsService(workspaceId, userId, filters);

    return res.status(HTTPSTATUS.OK).json({
      message: "Audit logs retrieved successfully",
      ...result,
    });
  }
);
