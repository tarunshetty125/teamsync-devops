import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import {
  listWorkspaceLoginsService,
  listWorkspaceSessionsService,
  revokeWorkspaceSessionService,
  revokeWorkspaceSessionsService,
} from "../services/session-registry.service";
import {
  securityQuerySchema,
  sessionIdParamSchema,
} from "../validation/governance.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

export const listWorkspaceSessionsController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id?.toString();
    const pagination = securityQuerySchema.parse(req.query);
    const result = await listWorkspaceSessionsService(
      workspaceId,
      userId,
      pagination
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Sessions retrieved successfully",
      ...result,
    });
  }
);

export const listWorkspaceLoginsController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id?.toString();
    const pagination = securityQuerySchema.parse(req.query);
    const result = await listWorkspaceLoginsService(
      workspaceId,
      userId,
      pagination
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Logins retrieved successfully",
      ...result,
    });
  }
);

export const revokeWorkspaceSessionController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const sessionId = sessionIdParamSchema.parse(req.params.sessionId);
    const userId = req.user?._id?.toString();

    await revokeWorkspaceSessionService(workspaceId, userId, sessionId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Session revoked successfully",
    });
  }
);

export const revokeWorkspaceSessionsController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id?.toString();

    await revokeWorkspaceSessionsService(workspaceId, userId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Sessions revoked successfully",
    });
  }
);
