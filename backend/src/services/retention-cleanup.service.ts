import {
  AuditActionEnum,
  DomainEntityTypeEnum,
  FileAssetStatusEnum,
} from "../enums/domain.enum";
import ActivityModel from "../models/activity.model";
import AuditLogModel from "../models/audit-log.model";
import CleanupRunModel from "../models/cleanup-run.model";
import CommentModel from "../models/comment.model";
import FileAssetModel from "../models/file-asset.model";
import NotificationModel from "../models/notification.model";
import WorkspaceModel from "../models/workspace.model";
import WorkspacePolicyModel, {
  RetentionDays,
} from "../models/workspace-policy.model";
import { LocalStorageProvider } from "../storage/local-storage-provider";
import { fileStorageConfig } from "../config/file-storage.config";
import { deleteExpiredExportFiles } from "./export.service";

const RUN_NAME = "enterprise-retention-cleanup";
const DAY_MS = 24 * 60 * 60 * 1000;
const storageProvider = new LocalStorageProvider(
  fileStorageConfig.LOCAL_FILE_STORAGE_DIR
);

const cutoffFor = (days: RetentionDays, now: Date) =>
  days === null ? null : new Date(now.getTime() - days * DAY_MS);

const acquireLock = async (now: Date) => {
  await CleanupRunModel.updateOne(
    { name: RUN_NAME },
    { $setOnInsert: { name: RUN_NAME, status: "IDLE" } },
    { upsert: true }
  );

  return CleanupRunModel.findOneAndUpdate(
    {
      name: RUN_NAME,
      $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
    },
    {
      $set: {
        name: RUN_NAME,
        status: "RUNNING",
        startedAt: now,
        lockedUntil: new Date(now.getTime() + 30 * 60 * 1000),
        errorMessage: null,
      },
    },
    { new: true }
  );
};

const writeCleanupAudit = async (
  workspaceId: string,
  policyId: string,
  counts: Record<string, number>
) => {
  const workspace = await WorkspaceModel.findById(workspaceId).select("owner");
  if (!workspace?.owner) return;

  await AuditLogModel.create({
    workspace: workspaceId,
    actor: workspace.owner,
    action: AuditActionEnum.DELETED,
    entityType: DomainEntityTypeEnum.WORKSPACE_POLICY,
    entityId: policyId,
    metadata: {
      cleanup: true,
      counts,
    },
    ipAddress: "system",
    userAgent: "retention-cleanup",
    requestId: `${RUN_NAME}:${Date.now()}`,
  });
};

export const runRetentionCleanup = async (now = new Date()) => {
  const lock = await acquireLock(now);
  if (!lock) return { skipped: true };

  const totalCounts: Record<string, number> = {};

  try {
    const policies = await WorkspacePolicyModel.find({}).lean();
    await deleteExpiredExportFiles(now);

    for (const policy of policies) {
      const workspaceId = policy.workspace.toString();
      const counts: Record<string, number> = {};
      const notificationCutoff = cutoffFor(policy.retention.notificationsDays, now);
      const activityCutoff = cutoffFor(policy.retention.activityDays, now);
      const auditCutoff = cutoffFor(policy.retention.auditDays, now);
      const commentCutoff = cutoffFor(policy.retention.commentsDays, now);
      const fileCutoff = cutoffFor(policy.retention.filesDays, now);

      if (notificationCutoff) {
        const result = await NotificationModel.deleteMany({
          workspace: workspaceId,
          createdAt: { $lt: notificationCutoff },
        });
        counts.notifications = result.deletedCount || 0;
      }

      if (activityCutoff) {
        const result = await ActivityModel.deleteMany({
          workspace: workspaceId,
          createdAt: { $lt: activityCutoff },
        });
        counts.activity = result.deletedCount || 0;
      }

      if (commentCutoff) {
        const result = await CommentModel.deleteMany({
          workspace: workspaceId,
          deletedAt: { $ne: null, $lt: commentCutoff },
        });
        counts.comments = result.deletedCount || 0;
      }

      if (fileCutoff) {
        const files = await FileAssetModel.find({
          workspace: workspaceId,
          status: FileAssetStatusEnum.DELETED,
          deletedAt: { $ne: null, $lt: fileCutoff },
        });

        for (const file of files) {
          await storageProvider.delete(file.storageKey);
          await file.deleteOne();
        }
        counts.files = files.length;
      }

      await writeCleanupAudit(workspaceId, policy._id.toString(), counts);

      if (auditCutoff) {
        const result = await AuditLogModel.deleteMany({
          workspace: workspaceId,
          createdAt: { $lt: auditCutoff },
        });
        counts.audit = result.deletedCount || 0;
      }

      Object.entries(counts).forEach(([key, value]) => {
        totalCounts[key] = (totalCounts[key] || 0) + value;
      });
    }

    lock.status = "COMPLETED";
    lock.finishedAt = new Date();
    lock.lockedUntil = null;
    await lock.save();

    return { skipped: false, counts: totalCounts };
  } catch (error) {
    lock.status = "FAILED";
    lock.finishedAt = new Date();
    lock.lockedUntil = null;
    lock.errorMessage = error instanceof Error ? error.message : "Cleanup failed";
    await lock.save();
    throw error;
  }
};

export const startRetentionCleanupRunner = () => {
  if (process.env.NODE_ENV === "test") return;

  const run = () =>
    runRetentionCleanup().catch((error) => {
      console.error("Retention cleanup failed", error);
    });

  setTimeout(run, 30_000);
  setInterval(run, DAY_MS);
};
