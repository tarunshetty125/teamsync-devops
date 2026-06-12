import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";
import ActivityModel from "../src/models/activity.model";
import AuditLogModel from "../src/models/audit-log.model";
import CommentModel from "../src/models/comment.model";
import FileAssetModel from "../src/models/file-asset.model";
import LabelModel from "../src/models/label.model";
import MentionModel from "../src/models/mention.model";
import MigrationRecordModel from "../src/models/migration-record.model";
import MilestoneModel from "../src/models/milestone.model";
import NotificationPreferenceModel from "../src/models/notification-preference.model";
import NotificationModel from "../src/models/notification.model";
import ProjectModel from "../src/models/project.model";
import TaskModel from "../src/models/task.model";
import TimeEntryModel from "../src/models/time-entry.model";
import UserModel from "../src/models/user.model";
import WorkspaceModel from "../src/models/workspace.model";
import { ProviderEnum } from "../src/enums/account-provider.enum";
import {
  ActivityTypeEnum,
  AuditActionEnum,
  CommentTargetTypeEnum,
  DomainEntityTypeEnum,
  DomainEventTypeEnum,
  FileAssetStatusEnum,
  FileStorageProviderEnum,
  MilestoneStatusEnum,
  NotificationTypeEnum,
  TimeEntrySourceEnum,
} from "../src/enums/domain.enum";
import { Permissions } from "../src/enums/role.enum";
import { recordActivity } from "../src/services/activity.service";
import { recordAuditLog } from "../src/services/audit-log.service";
import {
  clearDomainEventHandlersForTest,
  emitDomainEvent,
  registerDomainEventHandler,
} from "../src/services/domain-event.service";
import { runPendingMigrations } from "../src/services/migration.service";
import { createDraftNotificationRecord } from "../src/services/notification.service";
import { registerUserService } from "../src/services/auth.service";
import { RolePermissions } from "../src/utils/role-permission";
import { RequestContext } from "../src/types/request-context";

const strongPassword = "Str0ng!Pass";

const registerUser = async (email: string, name = "Foundation User") => {
  const result = await registerUserService({
    email,
    name,
    password: strongPassword,
  });

  const user = await UserModel.findById(result.userId);
  const workspace = await WorkspaceModel.findById(result.workspaceId);

  if (!user || !workspace) {
    throw new Error("Expected registered user and workspace to exist");
  }

  return { user, workspace };
};

const createProjectAndTask = async (
  workspaceId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
) => {
  const project = await ProjectModel.create({
    name: "Foundation Project",
    workspace: workspaceId,
    createdBy: userId,
  });

  const task = await TaskModel.create({
    title: "Foundation Task",
    project: project._id,
    workspace: workspaceId,
    createdBy: userId,
  });

  return { project, task };
};

const contextFor = (
  workspaceId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): RequestContext => ({
  requestId: "req-foundation-1",
  userId: userId.toString(),
  workspaceId: workspaceId.toString(),
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
});

describe("phase 0 foundation models", () => {
  it("requires a direct workspace reference on every future-facing model", () => {
    const workspaceScopedModels = [
      ActivityModel,
      AuditLogModel,
      CommentModel,
      FileAssetModel,
      LabelModel,
      MentionModel,
      MilestoneModel,
      NotificationPreferenceModel,
      NotificationModel,
      TimeEntryModel,
    ];

    for (const model of workspaceScopedModels) {
      const workspacePath = model.schema.path("workspace");
      expect(workspacePath).toBeTruthy();
      expect(workspacePath?.options.required).toBe(true);
    }

    expect(MigrationRecordModel.schema.path("workspace")).toBeUndefined();
  });

  it("creates foundation records with workspace scope and soft-delete defaults", async () => {
    const { user, workspace } = await registerUser("foundation@example.com");
    const { project, task } = await createProjectAndTask(
      workspace._id as mongoose.Types.ObjectId,
      user._id as mongoose.Types.ObjectId
    );
    const context = contextFor(
      workspace._id as mongoose.Types.ObjectId,
      user._id as mongoose.Types.ObjectId
    );

    const { auditLog } = await recordAuditLog(context, {
      action: AuditActionEnum.CREATED,
      entityType: DomainEntityTypeEnum.TASK,
      entityId: task._id.toString(),
      after: { title: task.title },
    });
    const { activity } = await recordActivity(context, {
      type: ActivityTypeEnum.TASK_CREATED,
      entityType: DomainEntityTypeEnum.TASK,
      entityId: task._id.toString(),
      projectId: project._id.toString(),
      taskId: task._id.toString(),
      summary: "Task created",
    });
    const { notification } = await createDraftNotificationRecord(context, {
      recipientId: user._id.toString(),
      type: NotificationTypeEnum.TASK_ASSIGNED,
      entityType: DomainEntityTypeEnum.TASK,
      entityId: task._id.toString(),
      title: "Task assigned",
      body: "A task was assigned to you",
    });

    const fileAsset = await FileAssetModel.create({
      workspace: workspace._id,
      owner: user._id,
      targetType: DomainEntityTypeEnum.TASK,
      targetId: task._id,
      storageProvider: FileStorageProviderEnum.LOCAL,
      storageKey: "task-attachments/foundation/file.pdf",
      originalName: "File.pdf",
      safeName: "file.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      checksum: "checksum-1",
      status: FileAssetStatusEnum.AVAILABLE,
    });
    const comment = await CommentModel.create({
      workspace: workspace._id,
      author: user._id,
      targetType: CommentTargetTypeEnum.TASK,
      targetId: task._id,
      bodyJson: { type: "doc", content: [] },
      plainText: "Foundation comment",
      mentions: [user._id],
    });
    const mention = await MentionModel.create({
      workspace: workspace._id,
      mentionedUser: user._id,
      mentionedBy: user._id,
      sourceType: DomainEntityTypeEnum.COMMENT,
      sourceId: comment._id,
      targetType: CommentTargetTypeEnum.TASK,
      targetId: task._id,
    });
    const label = await LabelModel.create({
      workspace: workspace._id,
      name: "Design",
      color: "#1f7aec",
      createdBy: user._id,
    });
    const milestone = await MilestoneModel.create({
      workspace: workspace._id,
      project: project._id,
      name: "Beta",
      status: MilestoneStatusEnum.PLANNED,
      createdBy: user._id,
    });
    const timeEntry = await TimeEntryModel.create({
      workspace: workspace._id,
      user: user._id,
      task: task._id,
      project: project._id,
      startedAt: new Date(),
      durationSeconds: 60,
      source: TimeEntrySourceEnum.MANUAL,
    });

    expect(auditLog.workspace.toString()).toBe(workspace._id.toString());
    expect(activity.workspace.toString()).toBe(workspace._id.toString());
    expect(notification.workspace.toString()).toBe(workspace._id.toString());
    expect(fileAsset.deletedAt).toBeNull();
    expect(notification.deletedAt).toBeNull();
    expect(comment.deletedAt).toBeNull();
    expect(label.deletedAt).toBeNull();
    expect(milestone.deletedAt).toBeNull();
    expect(timeEntry.deletedAt).toBeNull();
    expect(mention.workspace.toString()).toBe(workspace._id.toString());
  });

  it("defines comment indexes optimized for deletedAt filtering", () => {
    const indexes = CommentModel.schema.indexes().map(([fields]) => fields);

    expect(indexes).toContainEqual({
      workspace: 1,
      targetType: 1,
      targetId: 1,
      deletedAt: 1,
      createdAt: -1,
    });
    expect(indexes).toContainEqual({
      workspace: 1,
      parentComment: 1,
      deletedAt: 1,
      createdAt: 1,
    });
    expect(indexes).toContainEqual({
      workspace: 1,
      author: 1,
      deletedAt: 1,
      createdAt: -1,
    });
  });

  it("enforces label uniqueness per workspace", async () => {
    const { user, workspace } = await registerUser("labels@example.com");
    const { workspace: otherWorkspace } = await registerUser(
      "labels-other@example.com"
    );

    await LabelModel.create({
      workspace: workspace._id,
      name: "Urgent",
      color: "#ff0000",
      createdBy: user._id,
    });

    await expect(
      LabelModel.create({
        workspace: workspace._id,
        name: "Urgent",
        color: "#ff0000",
        createdBy: user._id,
      })
    ).rejects.toMatchObject({ code: 11000 });

    await expect(
      LabelModel.create({
        workspace: otherWorkspace._id,
        name: "Urgent",
        color: "#ff0000",
        createdBy: user._id,
      })
    ).resolves.toBeTruthy();
  });
});

describe("phase 0 domain infrastructure", () => {
  it("isolates domain event handler failures", async () => {
    clearDomainEventHandlersForTest();
    const successfulHandler = vi.fn();
    const failingHandler = vi.fn(async () => {
      throw new Error("handler failed");
    });

    registerDomainEventHandler(DomainEventTypeEnum.TASK_CREATED, failingHandler);
    registerDomainEventHandler(
      DomainEventTypeEnum.TASK_CREATED,
      successfulHandler
    );

    const result = await emitDomainEvent({
      type: DomainEventTypeEnum.TASK_CREATED,
      context: {
        requestId: "req-event",
        userId: new mongoose.Types.ObjectId().toString(),
        workspaceId: new mongoose.Types.ObjectId().toString(),
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      entityType: DomainEntityTypeEnum.TASK,
      entityId: new mongoose.Types.ObjectId().toString(),
      occurredAt: new Date(),
    });

    expect(result.handlerCount).toBe(2);
    expect(result.failures).toHaveLength(1);
    expect(failingHandler).toHaveBeenCalledTimes(1);
    expect(successfulHandler).toHaveBeenCalledTimes(1);

    clearDomainEventHandlersForTest();
  });

  it("supports domain event handler unsubscribe and empty emits", async () => {
    clearDomainEventHandlersForTest();
    const handler = vi.fn();
    const unsubscribe = registerDomainEventHandler(
      DomainEventTypeEnum.TASK_UPDATED,
      handler
    );

    unsubscribe();

    const result = await emitDomainEvent({
      type: DomainEventTypeEnum.TASK_UPDATED,
      context: {
        requestId: "req-event-empty",
        userId: new mongoose.Types.ObjectId().toString(),
        workspaceId: new mongoose.Types.ObjectId().toString(),
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      entityType: DomainEntityTypeEnum.TASK,
      entityId: new mongoose.Types.ObjectId().toString(),
      occurredAt: new Date(),
    });

    expect(result.handlerCount).toBe(0);
    expect(result.failures).toEqual([]);
    expect(handler).not.toHaveBeenCalled();

    clearDomainEventHandlersForTest();
  });

  it("prevents duplicate migration execution records", async () => {
    const up = vi.fn(async () => undefined);
    const down = vi.fn(async () => undefined);
    const migration = {
      name: "202606110001_test_migration",
      up,
      down,
    };

    const firstRun = await runPendingMigrations([migration]);
    const secondRun = await runPendingMigrations([migration]);

    expect(firstRun.applied).toEqual([migration.name]);
    expect(firstRun.skipped).toEqual([]);
    expect(secondRun.applied).toEqual([]);
    expect(secondRun.skipped).toEqual([migration.name]);
    expect(up).toHaveBeenCalledTimes(1);
    expect(await MigrationRecordModel.countDocuments()).toBe(1);
  });

  it("treats duplicate migration record races as skipped", async () => {
    const up = vi.fn(async () => undefined);
    const findOneSpy = vi
      .spyOn(MigrationRecordModel, "findOne")
      .mockResolvedValueOnce(null);
    const createSpy = vi
      .spyOn(MigrationRecordModel, "create")
      .mockRejectedValueOnce({ code: 11000 });

    const result = await runPendingMigrations([
      {
        name: "202606110002_racing_migration",
        up,
        down: vi.fn(async () => undefined),
      },
    ]);

    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual(["202606110002_racing_migration"]);
    expect(up).toHaveBeenCalledTimes(1);

    findOneSpy.mockRestore();
    createSpy.mockRestore();
  });

  it("propagates RequestContext into audit and activity records", async () => {
    const { user, workspace } = await registerUser("context@example.com");
    const { task } = await createProjectAndTask(
      workspace._id as mongoose.Types.ObjectId,
      user._id as mongoose.Types.ObjectId
    );
    const context = contextFor(
      workspace._id as mongoose.Types.ObjectId,
      user._id as mongoose.Types.ObjectId
    );

    const { auditLog } = await recordAuditLog(context, {
      action: AuditActionEnum.UPDATED,
      entityType: DomainEntityTypeEnum.TASK,
      entityId: task._id.toString(),
      before: { title: "Before" },
      after: { title: "After" },
    });
    const { activity } = await recordActivity(context, {
      type: ActivityTypeEnum.TASK_UPDATED,
      entityType: DomainEntityTypeEnum.TASK,
      entityId: task._id.toString(),
      summary: "Task updated",
    });

    expect(auditLog.requestId).toBe(context.requestId);
    expect(auditLog.ipAddress).toBe(context.ipAddress);
    expect(auditLog.userAgent).toBe(context.userAgent);
    expect(auditLog.actor.toString()).toBe(context.userId);
    expect(activity.requestId).toBe(context.requestId);
    expect(activity.actor.toString()).toBe(context.userId);
  });

  it("expands default RBAC permissions for future phases", () => {
    expect(Object.values(Permissions)).toEqual(
      expect.arrayContaining([
        Permissions.CREATE_COMMENT,
        Permissions.EDIT_COMMENT,
        Permissions.DELETE_COMMENT,
        Permissions.UPLOAD_FILE,
        Permissions.DELETE_FILE,
        Permissions.MANAGE_NOTIFICATION_SETTINGS,
        Permissions.EDIT_PROFILE,
        Permissions.MANAGE_TASK_RELATIONS,
        Permissions.EXPORT_DATA,
        Permissions.VIEW_AUDIT_LOG,
        Permissions.MANAGE_ROLES,
        Permissions.MANAGE_POLICIES,
      ])
    );

    expect(RolePermissions.OWNER).toEqual(
      expect.arrayContaining([
        Permissions.MANAGE_ROLES,
        Permissions.MANAGE_POLICIES,
      ])
    );
    expect(RolePermissions.ADMIN).not.toContain(Permissions.MANAGE_ROLES);
    expect(RolePermissions.ADMIN).not.toContain(Permissions.MANAGE_POLICIES);
    expect(RolePermissions.MEMBER).toEqual(
      expect.arrayContaining([
        Permissions.CREATE_COMMENT,
        Permissions.EDIT_COMMENT,
        Permissions.UPLOAD_FILE,
        Permissions.EDIT_PROFILE,
      ])
    );
  });
});
