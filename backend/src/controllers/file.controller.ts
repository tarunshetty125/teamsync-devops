import { createReadStream } from "fs";
import { NextFunction, Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { Permissions } from "../enums/role.enum";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { getMemberRoleInWorkspace } from "../services/member.service";
import {
  deleteFileAssetService,
  getFileForReadService,
  listFileAssetsForTargetService,
  uploadAvatarService,
  uploadFileAssetService,
} from "../services/file.service";
import { BadRequestException } from "../utils/appError";
import { buildRequestContext } from "../utils/request-context";
import { roleGuard } from "../utils/roleGuard";
import {
  fileIdSchema,
  fileListQuerySchema,
  fileTargetIdSchema,
  fileTargetTypeSchema,
} from "../validation/file.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

const getRequiredFile = (req: Request) => {
  if (!req.file) {
    throw new BadRequestException("A file upload is required");
  }

  return {
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    buffer: req.file.buffer,
  };
};

const contentDisposition = (type: "inline" | "attachment", filename: string) =>
  `${type}; filename="${filename.replace(/"/g, "")}"`;

export const uploadFileAssetController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const targetType = fileTargetTypeSchema.parse(req.params.targetType);
    const targetId = fileTargetIdSchema.parse(req.params.targetId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.UPLOAD_FILE]);

    const context = buildRequestContext(req, workspaceId);
    const result = await uploadFileAssetService(
      context,
      targetType,
      targetId,
      getRequiredFile(req)
    );

    return res.status(HTTPSTATUS.CREATED).json({
      message: "File uploaded successfully",
      ...result,
    });
  }
);

export const uploadAvatarController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_PROFILE]);

    const context = buildRequestContext(req, workspaceId);
    const result = await uploadAvatarService(context, getRequiredFile(req));

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Avatar uploaded successfully",
      ...result,
    });
  }
);

export const listFileAssetsForTargetController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const targetType = fileTargetTypeSchema.parse(req.params.targetType);
    const targetId = fileTargetIdSchema.parse(req.params.targetId);
    const pagination = fileListQuerySchema.parse(req.query);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await listFileAssetsForTargetService(
      workspaceId,
      targetType,
      targetId,
      pagination
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Files fetched successfully",
      ...result,
    });
  }
);

const streamFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
  disposition: "inline" | "attachment"
) => {
  const userId = req.user?._id;
  const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
  const fileId = fileIdSchema.parse(req.params.fileId);

  const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
  roleGuard(role, [Permissions.VIEW_ONLY]);

  const { file, filePath } = await getFileForReadService(workspaceId, fileId);

  res.status(HTTPSTATUS.OK);
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader(
    "Content-Disposition",
    contentDisposition(disposition, file.safeName)
  );
  res.setHeader("Cache-Control", "private, max-age=60");

  createReadStream(filePath)
    .on("error", next)
    .pipe(res);
};

export const previewFileAssetController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    await streamFile(req, res, next, "inline");
  }
);

export const downloadFileAssetController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    await streamFile(req, res, next, "attachment");
  }
);

export const deleteFileAssetController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const fileId = fileIdSchema.parse(req.params.fileId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.DELETE_FILE]);

    const context = buildRequestContext(req, workspaceId);
    await deleteFileAssetService(context, fileId, role);

    return res.status(HTTPSTATUS.OK).json({
      message: "File deleted successfully",
    });
  }
);
