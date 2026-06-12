import CleanupRunModel from "../models/cleanup-run.model";
import ExportJobModel from "../models/export-job.model";
import LoginEventModel from "../models/login-event.model";
import MemberModel from "../models/member.model";
import RoleModel from "../models/roles-permission.model";
import SessionRecordModel from "../models/session-record.model";
import WorkspaceModel from "../models/workspace.model";
import WorkspacePolicyModel, {
  defaultWorkspacePolicy,
} from "../models/workspace-policy.model";
import { RolePermissions } from "../utils/role-permission";
import { Migration } from "./types";

const ignoreMissingIndex = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    const codeName = (error as { codeName?: string }).codeName;
    if (codeName !== "IndexNotFound") {
      throw error;
    }
  }
};

export const phase13EnterpriseGovernanceMigration: Migration = {
  name: "202606120300_phase13_enterprise_governance",
  up: async () => {
    await ignoreMissingIndex(RoleModel.collection.dropIndex("name_1"));

    await Promise.all(
      Object.entries(RolePermissions).map(([name, permissions]) =>
        RoleModel.updateOne(
          { name, $or: [{ isSystem: true }, { isSystem: { $exists: false } }] },
          {
            $set: {
              name,
              permissions,
              isSystem: true,
              workspace: null,
              deletedAt: null,
              deletedBy: null,
            },
          },
          { upsert: true }
        )
      )
    );

    await MemberModel.updateMany(
      { status: { $exists: false } },
      { $set: { status: "ACTIVE", lastActiveAt: null } }
    );

    const workspaces = await WorkspaceModel.find({}).select("_id").lean();
    await Promise.all(
      workspaces.map((workspace) =>
        WorkspacePolicyModel.updateOne(
          { workspace: workspace._id },
          {
            $setOnInsert: {
              workspace: workspace._id,
              ...defaultWorkspacePolicy,
            },
          },
          { upsert: true }
        )
      )
    );

    await Promise.all([
      RoleModel.createIndexes(),
      MemberModel.createIndexes(),
      WorkspacePolicyModel.createIndexes(),
      ExportJobModel.createIndexes(),
      SessionRecordModel.createIndexes(),
      LoginEventModel.createIndexes(),
      CleanupRunModel.createIndexes(),
    ]);
  },
  down: async () => {
    // Enterprise governance data is intentionally retained.
  },
};
