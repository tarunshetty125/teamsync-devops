import crypto, { randomUUID } from "crypto";
import path from "path";
import mongoose from "mongoose";
import {
  ActivityTypeEnum,
  AuditActionEnum,
  DomainEntityType,
  DomainEntityTypeEnum,
  DomainEventTypeEnum,
  FileAssetStatusEnum,
  FileStorageProviderEnum,
} from "../enums/domain.enum";
import { Roles } from "../enums/role.enum";
import FileAssetModel, { FileAssetDocument } from "../models/file-asset.model";
import ProjectModel from "../models/project.model";
import TaskModel from "../models/task.model";
import UserModel from "../models/user.model";
import { LocalStorageProvider } from "../storage/local-storage-provider";
import { RequestContext } from "../types/request-context";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "../utils/appError";
import { validateUploadedFile } from "../utils/file-validation";
import { recordActivity } from "./activity.service";
import { recordAuditLog } from "./audit-log.service";
import { emitDomainEvent } from "./domain-event.service";
import { fileStorageConfig } from "../config/file-storage.config";
import { softDeleteFilesForTarget } from "./file-cleanup.service";
import { getOrCreateWorkspacePolicy } from "./workspace-policy.service";

type UploadFileInput = {
  originalName: string;
  mimeType?: string;
  buffer: Buffer;
};

type PaginationInput = {
  pageSize: number;
  pageNumber: number;
};

const storageProvider = new LocalStorageProvider(
  fileStorageConfig.LOCAL_FILE_STORAGE_DIR
);

const getDocumentId = (document: FileAssetDocument) =>
  document._id.toString();

const createStorageKey = ({
  workspaceId,
  targetType,
  targetId,
  safeName,
}: {
  workspaceId: string;
  targetType: DomainEntityType;
  targetId: string;
  safeName: string;
}) =>
  path.posix.join(
    "workspaces",
    workspaceId,
    targetType.toLowerCase(),
    targetId,
    `${randomUUID()}-${safeName}`
  );

const getPreviewPath = (workspaceId: string, fileId: string) =>
  `/file/workspace/${workspaceId}/${fileId}/preview`;

const getDownloadPath = (workspaceId: string, fileId: string) =>
  `/file/workspace/${workspaceId}/${fileId}/download`;

const serializeFileAsset = (file: FileAssetDocument) => {
  const fileId = getDocumentId(file);
  const workspaceId = file.workspace.toString();

  return {
    _id: fileId,
    workspace: workspaceId,
    owner: file.owner.toString(),
    targetType: file.targetType,
    targetId: file.targetId.toString(),
    originalName: file.originalName,
    safeName: file.safeName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    checksum: file.checksum,
    status: file.status,
    metadata: file.metadata,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    previewPath: getPreviewPath(workspaceId, fileId),
    downloadPath: getDownloadPath(workspaceId, fileId),
  };
};

const ensureTargetInWorkspace = async (
  workspaceId: string,
  targetType: DomainEntityType,
  targetId: string
) => {
  if (targetType === DomainEntityTypeEnum.TASK) {
    const task = await TaskModel.findOne({
      _id: targetId,
      workspace: workspaceId,
    }).select("_id project title");

    if (!task) {
      throw new NotFoundException(
        "Task not found or does not belong to this workspace"
      );
    }

    return {
      projectId: task.project?.toString() ?? null,
      taskId: task._id.toString(),
    };
  }

  if (targetType === DomainEntityTypeEnum.PROJECT) {
    const project = await ProjectModel.findOne({
      _id: targetId,
      workspace: workspaceId,
    }).select("_id name");

    if (!project) {
      throw new NotFoundException(
        "Project not found or does not belong to this workspace"
      );
    }

    return {
      projectId: project._id.toString(),
      taskId: null,
    };
  }

  throw new BadRequestException("Unsupported file target type");
};

const getAvailableFileOrThrow = async (workspaceId: string, fileId: string) => {
  const file = await FileAssetModel.findOne({
    _id: fileId,
    workspace: workspaceId,
    status: FileAssetStatusEnum.AVAILABLE,
    deletedAt: null,
  });

  if (!file) {
    throw new NotFoundException("File not found");
  }

  return file;
};

const canDeleteFile = (
  file: FileAssetDocument,
  context: RequestContext,
  role: string
) =>
  file.owner.toString() === context.userId ||
  role === Roles.OWNER ||
  role === Roles.ADMIN;

const recordFileUploadSideEffects = async (
  context: RequestContext,
  file: FileAssetDocument,
  target: { projectId: string | null; taskId: string | null }
) => {
  const fileId = getDocumentId(file);

  await Promise.all([
    recordActivity(context, {
      type: ActivityTypeEnum.FILE_UPLOADED,
      entityType: DomainEntityTypeEnum.FILE_ASSET,
      entityId: fileId,
      projectId: target.projectId,
      taskId: target.taskId,
      summary: "File uploaded",
      metadata: {
        targetType: file.targetType,
        targetId: file.targetId.toString(),
        safeName: file.safeName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      },
    }),
    recordAuditLog(context, {
      action: AuditActionEnum.CREATED,
      entityType: DomainEntityTypeEnum.FILE_ASSET,
      entityId: fileId,
      after: {
        targetType: file.targetType,
        targetId: file.targetId.toString(),
        safeName: file.safeName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        checksum: file.checksum,
      },
    }),
    emitDomainEvent({
      type: DomainEventTypeEnum.FILE_UPLOADED,
      context,
      entityType: DomainEntityTypeEnum.FILE_ASSET,
      entityId: fileId,
      target: {
        type: file.targetType,
        id: file.targetId.toString(),
      },
      metadata: {
        safeName: file.safeName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      },
      occurredAt: new Date(),
    }),
  ]);
};

export const uploadFileAssetService = async (
  context: RequestContext,
  targetType: DomainEntityType,
  targetId: string,
  upload: UploadFileInput
) => {
  const target = await ensureTargetInWorkspace(
    context.workspaceId,
    targetType,
    targetId
  );
  const validated = validateUploadedFile({
    buffer: upload.buffer,
    originalName: upload.originalName,
    maxBytes: fileStorageConfig.MAX_ATTACHMENT_BYTES,
  });
  const policy = await getOrCreateWorkspacePolicy(context.workspaceId);

  if (upload.buffer.length > policy.files.maxUploadBytes) {
    throw new BadRequestException("File exceeds workspace upload limit");
  }

  if (!policy.files.allowedMimeTypes.includes(validated.mimeType)) {
    throw new BadRequestException("File type is not allowed by workspace policy");
  }

  const storageKey = createStorageKey({
    workspaceId: context.workspaceId,
    targetType,
    targetId,
    safeName: validated.safeName,
  });
  const checksum = crypto
    .createHash("sha256")
    .update(upload.buffer)
    .digest("hex");

  await storageProvider.upload({
    workspaceId: context.workspaceId,
    targetType,
    targetId,
    storageKey,
    fileName: validated.safeName,
    mimeType: validated.mimeType,
    bytes: upload.buffer,
  });

  try {
    const file = await FileAssetModel.create({
      workspace: context.workspaceId,
      owner: context.userId,
      targetType,
      targetId,
      storageProvider: FileStorageProviderEnum.LOCAL,
      storageKey,
      originalName: upload.originalName,
      safeName: validated.safeName,
      mimeType: validated.mimeType,
      sizeBytes: upload.buffer.length,
      checksum,
      status: FileAssetStatusEnum.AVAILABLE,
      metadata: {
        kind: validated.kind,
        extension: validated.extension,
      },
    });

    await recordFileUploadSideEffects(context, file, target);

    return { file: serializeFileAsset(file) };
  } catch (error) {
    await storageProvider.delete(storageKey);
    throw error;
  }
};

export const listFileAssetsForTargetService = async (
  workspaceId: string,
  targetType: DomainEntityType,
  targetId: string,
  pagination: PaginationInput
) => {
  await ensureTargetInWorkspace(workspaceId, targetType, targetId);

  const { pageNumber, pageSize } = pagination;
  const skip = (pageNumber - 1) * pageSize;
  const query = {
    workspace: workspaceId,
    targetType,
    targetId,
    status: FileAssetStatusEnum.AVAILABLE,
    deletedAt: null,
  };

  const [files, totalCount] = await Promise.all([
    FileAssetModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    FileAssetModel.countDocuments(query),
  ]);

  return {
    files: files.map(serializeFileAsset),
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      skip,
      limit: pageSize,
    },
  };
};

export const getFileForReadService = async (
  workspaceId: string,
  fileId: string
) => {
  const file = await getAvailableFileOrThrow(workspaceId, fileId);
  const filePath = storageProvider.resolveStoragePath(file.storageKey);

  if (!(await storageProvider.exists(file.storageKey))) {
    throw new NotFoundException("Stored file is missing");
  }

  return {
    file,
    filePath,
  };
};

export const deleteFileAssetService = async (
  context: RequestContext,
  fileId: string,
  role: string
) => {
  const file = await getAvailableFileOrThrow(context.workspaceId, fileId);

  if (!canDeleteFile(file, context, role)) {
    throw new ForbiddenException("Only file owners, workspace owners, or admins can delete files");
  }
  const target =
    file.targetType === DomainEntityTypeEnum.TASK ||
    file.targetType === DomainEntityTypeEnum.PROJECT
      ? await ensureTargetInWorkspace(
          context.workspaceId,
          file.targetType,
          file.targetId.toString()
        )
      : {
          projectId: null,
          taskId: null,
        };

  file.status = FileAssetStatusEnum.DELETED;
  file.deletedAt = new Date();
  file.deletedBy = new mongoose.Types.ObjectId(context.userId);
  await file.save();
  await storageProvider.delete(file.storageKey);

  if (file.targetType === DomainEntityTypeEnum.USER) {
    await UserModel.updateOne(
      { _id: file.targetId, profilePicture: getPreviewPath(context.workspaceId, getDocumentId(file)) },
      { $set: { profilePicture: null } }
    );
  }

  await Promise.all([
    recordActivity(context, {
      type: ActivityTypeEnum.FILE_DELETED,
      entityType: DomainEntityTypeEnum.FILE_ASSET,
      entityId: getDocumentId(file),
      projectId: target.projectId,
      taskId: target.taskId,
      summary: "File deleted",
      metadata: {
        targetType: file.targetType,
        targetId: file.targetId.toString(),
        safeName: file.safeName,
      },
    }),
    recordAuditLog(context, {
      action: AuditActionEnum.DELETED,
      entityType: DomainEntityTypeEnum.FILE_ASSET,
      entityId: getDocumentId(file),
      before: {
        targetType: file.targetType,
        targetId: file.targetId.toString(),
        safeName: file.safeName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      },
    }),
    emitDomainEvent({
      type: DomainEventTypeEnum.FILE_DELETED,
      context,
      entityType: DomainEntityTypeEnum.FILE_ASSET,
      entityId: getDocumentId(file),
      target: {
        type: file.targetType,
        id: file.targetId.toString(),
      },
      metadata: {
        safeName: file.safeName,
      },
      occurredAt: new Date(),
    }),
  ]);
};

export const uploadAvatarService = async (
  context: RequestContext,
  upload: UploadFileInput
) => {
  const validated = validateUploadedFile({
    buffer: upload.buffer,
    originalName: upload.originalName,
    maxBytes: fileStorageConfig.MAX_AVATAR_BYTES,
    avatarOnly: true,
  });
  const targetType = DomainEntityTypeEnum.USER;
  const targetId = context.userId;
  const storageKey = createStorageKey({
    workspaceId: context.workspaceId,
    targetType,
    targetId,
    safeName: validated.safeName,
  });
  const checksum = crypto
    .createHash("sha256")
    .update(upload.buffer)
    .digest("hex");

  await storageProvider.upload({
    workspaceId: context.workspaceId,
    targetType,
    targetId,
    storageKey,
    fileName: validated.safeName,
    mimeType: validated.mimeType,
    bytes: upload.buffer,
  });

  try {
    const file = await FileAssetModel.create({
      workspace: context.workspaceId,
      owner: context.userId,
      targetType,
      targetId,
      storageProvider: FileStorageProviderEnum.LOCAL,
      storageKey,
      originalName: upload.originalName,
      safeName: validated.safeName,
      mimeType: validated.mimeType,
      sizeBytes: upload.buffer.length,
      checksum,
      status: FileAssetStatusEnum.AVAILABLE,
      metadata: {
        kind: validated.kind,
        extension: validated.extension,
        avatar: true,
      },
    });
    const profilePicture = getPreviewPath(context.workspaceId, getDocumentId(file));
    const oldAvatarFiles = await FileAssetModel.find({
      _id: { $ne: file._id },
      workspace: context.workspaceId,
      owner: context.userId,
      targetType,
      targetId,
      status: FileAssetStatusEnum.AVAILABLE,
      deletedAt: null,
      "metadata.avatar": true,
    });

    await UserModel.updateOne(
      { _id: context.userId },
      { $set: { profilePicture } }
    );

    await Promise.all(
      oldAvatarFiles.map(async (oldFile) => {
        oldFile.status = FileAssetStatusEnum.DELETED;
        oldFile.deletedAt = new Date();
        oldFile.deletedBy = new mongoose.Types.ObjectId(context.userId);
        await oldFile.save();
        await storageProvider.delete(oldFile.storageKey);
      })
    );

    await recordFileUploadSideEffects(context, file, {
      projectId: null,
      taskId: null,
    });

    return {
      file: serializeFileAsset(file),
      profilePicture,
    };
  } catch (error) {
    await storageProvider.delete(storageKey);
    throw error;
  }
};

export { softDeleteFilesForTarget };
