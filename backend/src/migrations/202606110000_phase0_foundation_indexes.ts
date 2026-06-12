import ActivityModel from "../models/activity.model";
import AuditLogModel from "../models/audit-log.model";
import CommentModel from "../models/comment.model";
import FileAssetModel from "../models/file-asset.model";
import LabelModel from "../models/label.model";
import MentionModel from "../models/mention.model";
import MigrationRecordModel from "../models/migration-record.model";
import MilestoneModel from "../models/milestone.model";
import NotificationPreferenceModel from "../models/notification-preference.model";
import NotificationModel from "../models/notification.model";
import TimeEntryModel from "../models/time-entry.model";
import { Migration } from "./types";

const foundationModels = [
  ActivityModel,
  AuditLogModel,
  CommentModel,
  FileAssetModel,
  LabelModel,
  MentionModel,
  MigrationRecordModel,
  MilestoneModel,
  NotificationPreferenceModel,
  NotificationModel,
  TimeEntryModel,
];

export const phase0FoundationIndexesMigration: Migration = {
  name: "202606110000_phase0_foundation_indexes",
  up: async () => {
    await Promise.all(foundationModels.map((model) => model.createIndexes()));
  },
  down: async () => {
    // Index rollback is intentionally a no-op for Phase 0 to avoid removing
    // indexes that may be shared by later phases after deployment.
  },
};
