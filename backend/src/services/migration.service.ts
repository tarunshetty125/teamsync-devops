import crypto from "crypto";
import MigrationRecordModel from "../models/migration-record.model";

export type Migration = {
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
};

type MigrationResult = {
  applied: string[];
  skipped: string[];
};

const checksumMigration = (migration: Migration) =>
  crypto
    .createHash("sha256")
    .update(`${migration.name}:${migration.up.toString()}`)
    .digest("hex");

export const runPendingMigrations = async (
  migrations: Migration[]
): Promise<MigrationResult> => {
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of migrations) {
    const existingRecord = await MigrationRecordModel.findOne({
      name: migration.name,
    });

    if (existingRecord) {
      skipped.push(migration.name);
      continue;
    }

    const startedAt = Date.now();
    await migration.up();

    try {
      await MigrationRecordModel.create({
        name: migration.name,
        checksum: checksumMigration(migration),
        appliedAt: new Date(),
        durationMs: Date.now() - startedAt,
      });
      applied.push(migration.name);
    } catch (error) {
      const duplicateKey =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000;

      if (!duplicateKey) {
        throw error;
      }

      skipped.push(migration.name);
    }
  }

  return { applied, skipped };
};
