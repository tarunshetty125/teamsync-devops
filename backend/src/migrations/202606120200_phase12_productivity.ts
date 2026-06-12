import MemberModel from "../models/member.model";
import RoleModel from "../models/roles-permission.model";
import TimeEntryModel from "../models/time-entry.model";
import { RolePermissions } from "../utils/role-permission";
import { Migration } from "./types";

export const phase12ProductivityMigration: Migration = {
  name: "202606120200_phase12_productivity",
  up: async () => {
    await MemberModel.updateMany(
      {
        $or: [
          { capacityHoursPerWeek: { $exists: false } },
          { capacityHoursPerWeek: null },
        ],
      },
      { $set: { capacityHoursPerWeek: 40 } }
    );

    await Promise.all([
      MemberModel.createIndexes(),
      TimeEntryModel.createIndexes(),
      ...Object.entries(RolePermissions).map(([name, permissions]) =>
        RoleModel.updateOne(
          { name, isSystem: true },
          { $set: { permissions } },
          { upsert: false }
        )
      ),
    ]);
  },
  down: async () => {
    // Keep productivity data, role permissions, and indexes intact on rollback.
  },
};
