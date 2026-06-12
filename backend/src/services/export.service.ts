import path from "path";
import ExcelJS from "exceljs";
import mongoose from "mongoose";
import {
  AuditActionEnum,
  DomainEntityTypeEnum,
} from "../enums/domain.enum";
import AuditLogModel from "../models/audit-log.model";
import CommentModel from "../models/comment.model";
import ExportJobModel, {
  ExportDataset,
  ExportDatasetEnum,
  ExportFormat,
  ExportFormatEnum,
  ExportJobDocument,
  ExportStatusEnum,
} from "../models/export-job.model";
import FileAssetModel from "../models/file-asset.model";
import MemberModel from "../models/member.model";
import ProjectModel from "../models/project.model";
import TaskModel from "../models/task.model";
import TimeEntryModel from "../models/time-entry.model";
import { LocalStorageProvider } from "../storage/local-storage-provider";
import { RequestContext } from "../types/request-context";
import { BadRequestException, NotFoundException } from "../utils/appError";
import { fileStorageConfig } from "../config/file-storage.config";
import { recordAuditLog } from "./audit-log.service";
import { assertOwnerOrAdmin } from "./governance-access.service";

const storageProvider = new LocalStorageProvider(
  fileStorageConfig.LOCAL_FILE_STORAGE_DIR
);

const exportMimes: Record<ExportFormat, string> = {
  CSV: "text/csv",
  JSON: "application/json",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const exportExtensions: Record<ExportFormat, string> = {
  CSV: "csv",
  JSON: "json",
  XLSX: "xlsx",
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const flatten = (value: unknown): string | number | boolean | null => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return value as string | number | boolean;
};

const normalizeRows = (rows: Record<string, unknown>[]) =>
  rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, flatten(value)])
    )
  );

const toCsv = (rows: Record<string, unknown>[]) => {
  const normalized = normalizeRows(rows);
  const headers = Array.from(
    normalized.reduce((keys, row) => {
      Object.keys(row).forEach((key) => keys.add(key));
      return keys;
    }, new Set<string>())
  );

  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [
    headers.map(escape).join(","),
    ...normalized.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
};

const getRowsForDataset = async (
  workspaceId: string,
  dataset: ExportDataset
): Promise<Record<string, unknown>[]> => {
  if (dataset === ExportDatasetEnum.TASKS) {
    return TaskModel.find({ workspace: workspaceId })
      .select("-__v")
      .lean<Record<string, unknown>[]>();
  }

  if (dataset === ExportDatasetEnum.PROJECTS) {
    return ProjectModel.find({ workspace: workspaceId })
      .select("-__v")
      .lean<Record<string, unknown>[]>();
  }

  if (dataset === ExportDatasetEnum.MEMBERS) {
    return MemberModel.find({ workspaceId })
      .populate("userId", "_id name email")
      .populate("role", "_id name")
      .select("-__v")
      .lean<Record<string, unknown>[]>();
  }

  if (dataset === ExportDatasetEnum.COMMENTS) {
    return CommentModel.find({ workspace: workspaceId, deletedAt: null })
      .select("-bodyJson -__v")
      .lean<Record<string, unknown>[]>();
  }

  if (dataset === ExportDatasetEnum.FILES) {
    return FileAssetModel.find({ workspace: workspaceId })
      .select("-storageKey -checksum -__v")
      .lean<Record<string, unknown>[]>();
  }

  if (dataset === ExportDatasetEnum.TIME_ENTRIES) {
    return TimeEntryModel.find({ workspace: workspaceId, deletedAt: null })
      .select("-__v")
      .lean<Record<string, unknown>[]>();
  }

  return AuditLogModel.find({ workspace: workspaceId })
    .select("-__v")
    .lean<Record<string, unknown>[]>();
};

const buildExportBytes = async (
  workspaceId: string,
  datasets: ExportDataset[],
  format: ExportFormat
) => {
  const rowsByDataset: Record<string, Record<string, unknown>[]> = {};

  for (const dataset of datasets) {
    rowsByDataset[dataset] = await getRowsForDataset(workspaceId, dataset);
  }

  if (format === ExportFormatEnum.CSV) {
    if (datasets.length !== 1) {
      throw new BadRequestException("CSV exports support exactly one dataset");
    }

    return Buffer.from(toCsv(rowsByDataset[datasets[0]]), "utf8");
  }

  if (format === ExportFormatEnum.JSON) {
    return Buffer.from(JSON.stringify(rowsByDataset, null, 2), "utf8");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TeamSync";
  workbook.created = new Date();

  for (const [dataset, rows] of Object.entries(rowsByDataset)) {
    const worksheet = workbook.addWorksheet(dataset.slice(0, 31));
    const normalized = normalizeRows(rows);
    const headers = Array.from(
      normalized.reduce((keys, row) => {
        Object.keys(row).forEach((key) => keys.add(key));
        return keys;
      }, new Set<string>())
    );

    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.min(Math.max(header.length + 4, 14), 36),
    }));
    worksheet.addRows(normalized);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
};

const serializeExport = (job: ExportJobDocument) => ({
  _id: job._id.toString(),
  workspace: job.workspace.toString(),
  requestedBy: job.requestedBy.toString(),
  datasets: job.datasets,
  format: job.format,
  status: job.status,
  fileName: job.fileName,
  mimeType: job.mimeType,
  sizeBytes: job.sizeBytes,
  errorMessage: job.errorMessage,
  expiresAt: job.expiresAt,
  createdAt: job.createdAt,
  downloadPath:
    job.status === ExportStatusEnum.COMPLETED
      ? `/export/workspace/${job.workspace.toString()}/${job._id.toString()}`
      : null,
});

export const createExportService = async (
  context: RequestContext,
  input: { datasets: ExportDataset[]; format: ExportFormat }
) => {
  await assertOwnerOrAdmin(context.workspaceId, context.userId);

  const expiresAt = addDays(new Date(), 7);
  const job = await ExportJobModel.create({
    workspace: context.workspaceId,
    requestedBy: context.userId,
    datasets: input.datasets,
    format: input.format,
    status: ExportStatusEnum.FAILED,
    expiresAt,
  });

  try {
    const extension = exportExtensions[input.format];
    const fileName = `teamsync-${context.workspaceId}-${job._id.toString()}.${extension}`;
    const storageKey = path.posix.join(
      "workspaces",
      context.workspaceId,
      "exports",
      job._id.toString(),
      fileName
    );
    const bytes = await buildExportBytes(
      context.workspaceId,
      input.datasets,
      input.format
    );

    await storageProvider.upload({
      workspaceId: context.workspaceId,
      targetType: DomainEntityTypeEnum.EXPORT_JOB,
      targetId: job._id.toString(),
      fileName,
      mimeType: exportMimes[input.format],
      bytes,
      storageKey,
    });

    job.status = ExportStatusEnum.COMPLETED;
    job.storageKey = storageKey;
    job.fileName = fileName;
    job.mimeType = exportMimes[input.format];
    job.sizeBytes = bytes.length;
    job.errorMessage = null;
    await job.save();

    await recordAuditLog(context, {
      action: AuditActionEnum.EXPORTED,
      entityType: DomainEntityTypeEnum.EXPORT_JOB,
      entityId: job._id.toString(),
      after: {
        datasets: input.datasets,
        format: input.format,
        sizeBytes: bytes.length,
      },
    });

    return { exportJob: serializeExport(job) };
  } catch (error) {
    job.status = ExportStatusEnum.FAILED;
    job.errorMessage =
      error instanceof Error ? error.message : "Export generation failed";
    await job.save();
    throw error;
  }
};

export const listExportsService = async (
  workspaceId: string,
  userId: string,
  pagination: { pageNumber: number; pageSize: number }
) => {
  await assertOwnerOrAdmin(workspaceId, userId);

  const skip = (pagination.pageNumber - 1) * pagination.pageSize;
  const query = { workspace: workspaceId, deletedAt: null };
  const [exportJobs, totalCount] = await Promise.all([
    ExportJobModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pagination.pageSize),
    ExportJobModel.countDocuments(query),
  ]);

  return {
    exportJobs: exportJobs.map(serializeExport),
    pagination: {
      totalCount,
      pageSize: pagination.pageSize,
      pageNumber: pagination.pageNumber,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
      skip,
      limit: pagination.pageSize,
    },
  };
};

export const getExportForReadService = async (
  workspaceId: string,
  userId: string,
  exportId: string
) => {
  await assertOwnerOrAdmin(workspaceId, userId);

  const exportJob = await ExportJobModel.findOne({
    _id: exportId,
    workspace: workspaceId,
    deletedAt: null,
    status: ExportStatusEnum.COMPLETED,
  });

  if (!exportJob || !exportJob.storageKey) {
    throw new NotFoundException("Export not found");
  }

  return {
    exportJob,
    filePath: storageProvider.resolveStoragePath(exportJob.storageKey),
  };
};

export const deleteExportService = async (
  context: RequestContext,
  exportId: string
) => {
  await assertOwnerOrAdmin(context.workspaceId, context.userId);

  const exportJob = await ExportJobModel.findOne({
    _id: exportId,
    workspace: context.workspaceId,
    deletedAt: null,
  });

  if (!exportJob) {
    throw new NotFoundException("Export not found");
  }

  exportJob.deletedAt = new Date();
  exportJob.deletedBy = new mongoose.Types.ObjectId(context.userId);
  await exportJob.save();

  if (exportJob.storageKey) {
    await storageProvider.delete(exportJob.storageKey);
  }

  await recordAuditLog(context, {
    action: AuditActionEnum.DELETED,
    entityType: DomainEntityTypeEnum.EXPORT_JOB,
    entityId: exportJob._id.toString(),
    before: serializeExport(exportJob),
  });
};

export const deleteExpiredExportFiles = async (now = new Date()) => {
  const expired = await ExportJobModel.find({
    expiresAt: { $lte: now },
    deletedAt: null,
  });

  for (const exportJob of expired) {
    exportJob.deletedAt = now;
    if (exportJob.storageKey) {
      await storageProvider.delete(exportJob.storageKey);
    }
    await exportJob.save();
  }

  return expired.length;
};
