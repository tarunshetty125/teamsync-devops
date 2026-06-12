import { phase0FoundationIndexesMigration } from "./202606110000_phase0_foundation_indexes";
import { phase3NotificationIndexesMigration } from "./202606110003_phase3_notification_indexes";
import { phase9TaskCompletedAtMigration } from "./202606120000_phase9_task_completed_at";
import { phase11TaskScheduleDatesMigration } from "./202606120100_phase11_task_schedule_dates";
import { phase12ProductivityMigration } from "./202606120200_phase12_productivity";
import { phase13EnterpriseGovernanceMigration } from "./202606120300_phase13_enterprise_governance";
import { phase14ReleaseHardeningIndexesMigration } from "./202606120400_phase14_release_hardening_indexes";
import { Migration } from "./types";

export const migrations: Migration[] = [
  phase0FoundationIndexesMigration,
  phase3NotificationIndexesMigration,
  phase9TaskCompletedAtMigration,
  phase11TaskScheduleDatesMigration,
  phase12ProductivityMigration,
  phase13EnterpriseGovernanceMigration,
  phase14ReleaseHardeningIndexesMigration,
];
