import ActivityModel from "../models/activity.model";
import AuditLogModel from "../models/audit-log.model";
import FileAssetModel from "../models/file-asset.model";
import { Migration } from "./types";

export const phase14ReleaseHardeningIndexesMigration: Migration = {
  name: "202606120400_phase14_release_hardening_indexes",
  up: async () => {
    await Promise.all([
      ActivityModel.createIndexes(),
      AuditLogModel.createIndexes(),
      FileAssetModel.createIndexes(),
    ]);
  },
  down: async () => {
    // Keep release hardening indexes in place to avoid production query regressions.
  },
};
