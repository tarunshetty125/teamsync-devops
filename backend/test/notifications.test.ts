import { afterEach, beforeEach, describe, expect, it } from "vitest";
import MemberModel from "../src/models/member.model";
import NotificationModel from "../src/models/notification.model";
import NotificationPreferenceModel from "../src/models/notification-preference.model";
import RoleModel from "../src/models/roles-permission.model";
import {
  DomainEntityTypeEnum,
  DomainEventTypeEnum,
  NotificationCategoryEnum,
  NotificationTypeEnum,
} from "../src/enums/domain.enum";
import { Roles } from "../src/enums/role.enum";
import { TaskPriorityEnum, TaskStatusEnum } from "../src/enums/task.enum";
import { registerUserService } from "../src/services/auth.service";
import { createCommentService } from "../src/services/comment.service";
import {
  clearDomainEventHandlersForTest,
  emitDomainEvent,
} from "../src/services/domain-event.service";
import { uploadFileAssetService } from "../src/services/file.service";
import {
  registerNotificationEventHandlers,
  resetNotificationEventHandlersForTest,
} from "../src/services/notification-event-handlers.service";
import {
  createNotificationRecord,
  getNotificationPreferencesService,
  getUnreadNotificationCountService,
  listNotificationsService,
  markAllNotificationsReadService,
  markNotificationReadService,
  softDeleteNotificationService,
  updateNotificationPreferencesService,
} from "../src/services/notification.service";
import { createProjectService } from "../src/services/project.service";
import { createTaskService } from "../src/services/task.service";
import { RequestContext } from "../src/types/request-context";

const password = "Str0ng!Pass";
const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);

const registerUser = async (email: string, name: string) => {
  const result = await registerUserService({
    email,
    name,
    password,
  });

  return {
    userId: result.userId.toString(),
    workspaceId: result.workspaceId.toString(),
  };
};

const contextFor = (
  userId: string,
  workspaceId: string,
  requestId = `${userId}-${workspaceId}`
): RequestContext => ({
  requestId,
  userId,
  workspaceId,
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
});

const addMemberToWorkspace = async (
  userId: string,
  workspaceId: string,
  roleName = Roles.MEMBER
) => {
  const role = await RoleModel.findOne({ name: roleName });

  if (!role) {
    throw new Error(`Expected ${roleName} role to exist`);
  }

  await MemberModel.create({
    userId,
    workspaceId,
    role: role._id,
  });
};

const createProjectAndTask = async (
  owner: { userId: string; workspaceId: string },
  assignedTo?: string
) => {
  const { project } = await createProjectService(
    owner.userId,
    owner.workspaceId,
    { name: "Notification Project", description: "Notification target" },
    contextFor(owner.userId, owner.workspaceId, "project-create")
  );
  const { task } = await createTaskService(
    owner.workspaceId,
    project._id.toString(),
    owner.userId,
    {
      title: "Notification Task",
      description: "Notification task",
      priority: TaskPriorityEnum.MEDIUM,
      status: TaskStatusEnum.TODO,
      assignedTo,
    },
    contextFor(owner.userId, owner.workspaceId, "task-create")
  );

  return { project, task };
};

const tiptapDoc = (text: string, mentionUserId?: string) => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: mentionUserId
        ? [
            { type: "text", text },
            {
              type: "mention",
              attrs: {
                id: mentionUserId,
                label: "Mentioned User",
              },
            },
          ]
        : [{ type: "text", text }],
    },
  ],
});

describe("notification infrastructure", () => {
  beforeEach(() => {
    clearDomainEventHandlersForTest();
    resetNotificationEventHandlersForTest();
    registerNotificationEventHandlers();
  });

  afterEach(() => {
    clearDomainEventHandlersForTest();
    resetNotificationEventHandlersForTest();
  });

  it("defines category and inbox indexes without due-date reminder types", () => {
    const indexes = NotificationModel.schema.indexes().map(([fields]) => fields);

    expect(Object.values(NotificationTypeEnum)).not.toContain(
      "DUE_DATE_APPROACHING"
    );
    expect(indexes).toContainEqual({
      workspace: 1,
      recipient: 1,
      deletedAt: 1,
      readAt: 1,
      createdAt: -1,
    });
    expect(NotificationModel.schema.path("category")).toBeTruthy();
    expect(NotificationPreferenceModel.schema.path("workspace")).toBeTruthy();
  });

  it("lists, counts, marks read, marks all read, and hides soft-deleted notifications", async () => {
    const owner = await registerUser("notify-owner@example.com", "Owner");
    const member = await registerUser("notify-member@example.com", "Member");
    await addMemberToWorkspace(member.userId, owner.workspaceId);
    const context = contextFor(owner.userId, owner.workspaceId);

    const first = await createNotificationRecord(context, {
      recipientId: member.userId,
      type: NotificationTypeEnum.TASK_ASSIGNED,
      category: NotificationCategoryEnum.TASK,
      entityType: DomainEntityTypeEnum.TASK,
      entityId: owner.workspaceId,
      title: "First",
      body: "First notification",
    });
    await createNotificationRecord(context, {
      recipientId: member.userId,
      type: NotificationTypeEnum.PROJECT_CREATED,
      category: NotificationCategoryEnum.PROJECT,
      entityType: DomainEntityTypeEnum.PROJECT,
      entityId: owner.workspaceId,
      title: "Second",
      body: "Second notification",
    });

    expect(
      await getUnreadNotificationCountService(owner.workspaceId, member.userId)
    ).toEqual({ unreadCount: 2 });

    const listed = await listNotificationsService(
      owner.workspaceId,
      member.userId,
      {},
      { pageNumber: 1, pageSize: 20 }
    );
    expect(listed.notifications).toHaveLength(2);

    await markNotificationReadService(
      owner.workspaceId,
      member.userId,
      first.notification!._id
    );
    expect(
      await getUnreadNotificationCountService(owner.workspaceId, member.userId)
    ).toEqual({ unreadCount: 1 });

    await markAllNotificationsReadService(owner.workspaceId, member.userId);
    expect(
      await getUnreadNotificationCountService(owner.workspaceId, member.userId)
    ).toEqual({ unreadCount: 0 });

    await softDeleteNotificationService(
      contextFor(member.userId, owner.workspaceId),
      first.notification!._id
    );

    const afterDelete = await listNotificationsService(
      owner.workspaceId,
      member.userId,
      {},
      { pageNumber: 1, pageSize: 20 }
    );
    expect(afterDelete.notifications).toHaveLength(1);
  });

  it("respects preferences, prevents duplicate notification records, and isolates recipients", async () => {
    const owner = await registerUser("pref-owner@example.com", "Owner");
    const member = await registerUser("pref-member@example.com", "Member");
    await addMemberToWorkspace(member.userId, owner.workspaceId);
    const context = contextFor(owner.userId, owner.workspaceId);

    const defaults = await getNotificationPreferencesService(
      owner.workspaceId,
      member.userId
    );
    expect(defaults.preferences.TASK_ASSIGNED).toBe(true);

    await updateNotificationPreferencesService(owner.workspaceId, member.userId, {
      TASK_ASSIGNED: false,
    });

    const suppressed = await createNotificationRecord(context, {
      recipientId: member.userId,
      type: NotificationTypeEnum.TASK_ASSIGNED,
      category: NotificationCategoryEnum.TASK,
      entityType: DomainEntityTypeEnum.TASK,
      entityId: owner.workspaceId,
      title: "Suppressed",
      body: "This should not be created",
    });
    expect(suppressed.skippedReason).toBe("preference");

    await updateNotificationPreferencesService(owner.workspaceId, member.userId, {
      TASK_ASSIGNED: true,
    });

    const first = await createNotificationRecord(context, {
      recipientId: member.userId,
      type: NotificationTypeEnum.TASK_ASSIGNED,
      category: NotificationCategoryEnum.TASK,
      entityType: DomainEntityTypeEnum.TASK,
      entityId: owner.workspaceId,
      title: "Dedupe",
      body: "Dedupe notification",
      dedupeKey: "dedupe-key",
    });
    const duplicate = await createNotificationRecord(context, {
      recipientId: member.userId,
      type: NotificationTypeEnum.TASK_ASSIGNED,
      category: NotificationCategoryEnum.TASK,
      entityType: DomainEntityTypeEnum.TASK,
      entityId: owner.workspaceId,
      title: "Dedupe",
      body: "Dedupe notification",
      dedupeKey: "dedupe-key",
    });

    expect(first.created).toBe(true);
    expect(duplicate.skippedReason).toBe("duplicate");
    expect(await NotificationModel.countDocuments({ recipient: member.userId })).toBe(1);

    const ownerList = await listNotificationsService(
      owner.workspaceId,
      owner.userId,
      {},
      { pageNumber: 1, pageSize: 20 }
    );
    expect(ownerList.notifications).toHaveLength(0);
  });

  it("generates task, comment, mention, project, invite, and file notifications from domain events", async () => {
    const owner = await registerUser("events-owner@example.com", "Owner");
    const member = await registerUser("events-member@example.com", "Member");
    const admin = await registerUser("events-admin@example.com", "Admin");
    await addMemberToWorkspace(member.userId, owner.workspaceId);
    await addMemberToWorkspace(admin.userId, owner.workspaceId, Roles.ADMIN);

    const { project, task } = await createProjectAndTask(owner, member.userId);

    await createCommentService(
      contextFor(owner.userId, owner.workspaceId, "comment-add"),
      DomainEntityTypeEnum.TASK,
      task._id.toString(),
      {
        plainText: "Please review this task",
        bodyJson: tiptapDoc("Please review this task"),
      }
    );

    await createCommentService(
      contextFor(owner.userId, owner.workspaceId, "comment-mention"),
      DomainEntityTypeEnum.TASK,
      task._id.toString(),
      {
        plainText: "Mentioning teammate",
        bodyJson: tiptapDoc("Mentioning teammate", member.userId),
      }
    );

    await uploadFileAssetService(
      contextFor(owner.userId, owner.workspaceId, "file-upload"),
      DomainEntityTypeEnum.TASK,
      task._id.toString(),
      {
        originalName: "notification.png",
        mimeType: "image/png",
        buffer: pngBuffer,
      }
    );

    await emitDomainEvent({
      type: DomainEventTypeEnum.MEMBER_JOINED,
      context: contextFor(member.userId, owner.workspaceId, "member-joined"),
      entityType: DomainEntityTypeEnum.MEMBER,
      entityId: member.userId,
      target: {
        type: DomainEntityTypeEnum.WORKSPACE,
        id: owner.workspaceId,
      },
      metadata: {
        joinedUserId: member.userId,
        inviteAccepted: true,
      },
      occurredAt: new Date(),
    });

    const memberNotifications = await listNotificationsService(
      owner.workspaceId,
      member.userId,
      {},
      { pageNumber: 1, pageSize: 50 }
    );
    const adminNotifications = await listNotificationsService(
      owner.workspaceId,
      admin.userId,
      {},
      { pageNumber: 1, pageSize: 50 }
    );

    expect(memberNotifications.notifications.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        NotificationTypeEnum.TASK_ASSIGNED,
        NotificationTypeEnum.COMMENT_ADDED,
        NotificationTypeEnum.MENTION_RECEIVED,
        NotificationTypeEnum.FILE_UPLOADED,
      ])
    );
    expect(adminNotifications.notifications.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        NotificationTypeEnum.PROJECT_CREATED,
        NotificationTypeEnum.INVITE_ACCEPTED,
      ])
    );
    expect(
      memberNotifications.notifications.every(
        (item) => item.metadata?.path && item.workspace === owner.workspaceId
      )
    ).toBe(true);
    expect(project._id).toBeTruthy();
  });
});
