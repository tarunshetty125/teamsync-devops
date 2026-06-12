import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach } from "vitest";
import AccountModel from "../src/models/account.model";
import ActivityModel from "../src/models/activity.model";
import AuditLogModel from "../src/models/audit-log.model";
import CommentModel from "../src/models/comment.model";
import FileAssetModel from "../src/models/file-asset.model";
import ExportJobModel from "../src/models/export-job.model";
import LabelModel from "../src/models/label.model";
import LoginEventModel from "../src/models/login-event.model";
import MemberModel from "../src/models/member.model";
import MentionModel from "../src/models/mention.model";
import MigrationRecordModel from "../src/models/migration-record.model";
import MilestoneModel from "../src/models/milestone.model";
import NotificationPreferenceModel from "../src/models/notification-preference.model";
import NotificationModel from "../src/models/notification.model";
import ProjectModel from "../src/models/project.model";
import RoleModel from "../src/models/roles-permission.model";
import SessionRecordModel from "../src/models/session-record.model";
import TaskModel from "../src/models/task.model";
import TaskDependencyModel from "../src/models/task-dependency.model";
import TaskWatcherModel from "../src/models/task-watcher.model";
import TimeEntryModel from "../src/models/time-entry.model";
import UserModel from "../src/models/user.model";
import WorkspaceModel from "../src/models/workspace.model";
import WorkspacePolicyModel from "../src/models/workspace-policy.model";
import CleanupRunModel from "../src/models/cleanup-run.model";
import { RolePermissions } from "../src/utils/role-permission";

let replSet: MongoMemoryReplSet;

const seedRoles = async () => {
  await RoleModel.insertMany(
    Object.entries(RolePermissions).map(([name, permissions]) => ({
      name,
      permissions,
      isSystem: true,
      workspace: null,
    }))
  );
};

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  await mongoose.connect(replSet.getUri(), {
    dbName: "teamsync-test",
  });

  await Promise.all([
    AccountModel.init(),
    ActivityModel.init(),
    AuditLogModel.init(),
    CommentModel.init(),
    CleanupRunModel.init(),
    ExportJobModel.init(),
    FileAssetModel.init(),
    LabelModel.init(),
    LoginEventModel.init(),
    MemberModel.init(),
    MentionModel.init(),
    MigrationRecordModel.init(),
    MilestoneModel.init(),
    NotificationPreferenceModel.init(),
    NotificationModel.init(),
    ProjectModel.init(),
    RoleModel.init(),
    SessionRecordModel.init(),
    TaskModel.init(),
    TaskDependencyModel.init(),
    TaskWatcherModel.init(),
    TimeEntryModel.init(),
    UserModel.init(),
    WorkspaceModel.init(),
    WorkspacePolicyModel.init(),
  ]);
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({})
    )
  );

  await seedRoles();
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});
