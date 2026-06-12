import mongoose from "mongoose";
import AuditLogModel from "../models/audit-log.model";
import { assertOwnerOrAdmin } from "./governance-access.service";

type AuditFilters = {
  userId?: string;
  entityType?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  q?: string;
  pageNumber: number;
  pageSize: number;
};

const serializeAuditLog = (log: Record<string, any>) => ({
  _id: log._id.toString(),
  workspace: log.workspace.toString(),
  actor:
    log.actor && typeof log.actor === "object" && "_id" in log.actor
      ? {
          _id: log.actor._id.toString(),
          name: log.actor.name || "",
          email: log.actor.email || "",
        }
      : log.actor?.toString?.() ?? null,
  action: log.action,
  entityType: log.entityType,
  entityId: log.entityId.toString(),
  before: log.before,
  after: log.after,
  metadata: log.metadata,
  ipAddress: log.ipAddress,
  userAgent: log.userAgent,
  requestId: log.requestId,
  createdAt: log.createdAt,
});

export const listAuditLogsService = async (
  workspaceId: string,
  userId: string,
  filters: AuditFilters
) => {
  await assertOwnerOrAdmin(workspaceId, userId);

  const query: Record<string, unknown> = {
    workspace: new mongoose.Types.ObjectId(workspaceId),
  };

  if (filters.userId) query.actor = new mongoose.Types.ObjectId(filters.userId);
  if (filters.entityType) query.entityType = filters.entityType;
  if (filters.action) query.action = filters.action;
  if (filters.startDate || filters.endDate) {
    query.createdAt = {
      ...(filters.startDate ? { $gte: filters.startDate } : {}),
      ...(filters.endDate ? { $lte: filters.endDate } : {}),
    };
  }
  if (filters.q) {
    query.$or = [
      { requestId: { $regex: filters.q, $options: "i" } },
      { entityType: { $regex: filters.q, $options: "i" } },
      { action: { $regex: filters.q, $options: "i" } },
    ];
  }

  const skip = (filters.pageNumber - 1) * filters.pageSize;
  const [logs, totalCount] = await Promise.all([
    AuditLogModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filters.pageSize)
      .populate("actor", "_id name email")
      .lean(),
    AuditLogModel.countDocuments(query),
  ]);

  return {
    auditLogs: logs.map(serializeAuditLog),
    pagination: {
      totalCount,
      pageSize: filters.pageSize,
      pageNumber: filters.pageNumber,
      totalPages: Math.ceil(totalCount / filters.pageSize),
      skip,
      limit: filters.pageSize,
    },
  };
};
