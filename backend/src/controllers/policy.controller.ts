import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import {
  getWorkspacePolicyService,
  updateWorkspacePolicyService,
} from "../services/workspace-policy.service";
import { buildRequestContext } from "../utils/request-context";
import { policyPayloadSchema } from "../validation/governance.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

export const getWorkspacePolicyController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id?.toString();
    const result = await getWorkspacePolicyService(workspaceId, userId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Workspace policy retrieved successfully",
      ...result,
    });
  }
);

export const updateWorkspacePolicyController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = policyPayloadSchema.parse(req.body);
    const context = buildRequestContext(req, workspaceId);
    const result = await updateWorkspacePolicyService(context, body);

    return res.status(HTTPSTATUS.OK).json({
      message: "Workspace policy updated successfully",
      ...result,
    });
  }
);
