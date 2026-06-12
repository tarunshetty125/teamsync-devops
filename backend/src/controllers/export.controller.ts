import { createReadStream } from "fs";
import { NextFunction, Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import {
  createExportService,
  deleteExportService,
  getExportForReadService,
  listExportsService,
} from "../services/export.service";
import { buildRequestContext } from "../utils/request-context";
import {
  exportIdSchema,
  exportListQuerySchema,
  exportPayloadSchema,
} from "../validation/governance.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

export const createExportController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = exportPayloadSchema.parse(req.body);
    const context = buildRequestContext(req, workspaceId);
    const result = await createExportService(context, body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Export generated successfully",
      ...result,
    });
  }
);

export const listExportsController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id?.toString();
    const pagination = exportListQuerySchema.parse(req.query);
    const result = await listExportsService(workspaceId, userId, pagination);

    return res.status(HTTPSTATUS.OK).json({
      message: "Exports retrieved successfully",
      ...result,
    });
  }
);

export const downloadExportController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const exportId = exportIdSchema.parse(req.params.exportId);
    const userId = req.user?._id?.toString();
    const { exportJob, filePath } = await getExportForReadService(
      workspaceId,
      userId,
      exportId
    );

    res.status(HTTPSTATUS.OK);
    res.setHeader("Content-Type", exportJob.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${(exportJob.fileName || "teamsync-export").replace(
        /"/g,
        ""
      )}"`
    );

    createReadStream(filePath).on("error", next).pipe(res);
  }
);

export const deleteExportController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const exportId = exportIdSchema.parse(req.params.exportId);
    const context = buildRequestContext(req, workspaceId);

    await deleteExportService(context, exportId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Export deleted successfully",
    });
  }
);
