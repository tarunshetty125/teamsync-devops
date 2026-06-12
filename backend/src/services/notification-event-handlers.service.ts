import mongoose from "mongoose";
import {
  CommentTargetTypeEnum,
  DomainEntityTypeEnum,
  DomainEventTypeEnum,
  NotificationCategoryEnum,
  NotificationTypeEnum,
} from "../enums/domain.enum";
import { Roles } from "../enums/role.enum";
import CommentModel from "../models/comment.model";
import FileAssetModel from "../models/file-asset.model";
import MemberModel from "../models/member.model";
import ProjectModel from "../models/project.model";
import TaskModel from "../models/task.model";
import TaskWatcherModel from "../models/task-watcher.model";
import UserModel from "../models/user.model";
import { DomainEvent, registerDomainEventHandler } from "./domain-event.service";
import { createNotificationsForRecipients } from "./notification.service";

type MemberWithRole = {
  userId: mongoose.Types.ObjectId;
  role?: {
    name?: string;
  };
};

const compactUnique = (ids: Array<string | null | undefined>) =>
  Array.from(new Set(ids.filter((id): id is string => Boolean(id))));

const asStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const getPathForProject = (workspaceId: string, projectId: string) =>
  `/workspace/${workspaceId}/project/${projectId}`;

const getPathForTask = (
  workspaceId: string,
  projectId: string,
  taskId: string
) => `${getPathForProject(workspaceId, projectId)}?taskId=${taskId}`;

const summarize = (value: string, fallback: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
};

const getOwnerAndAdminRecipientIds = async (workspaceId: string) => {
  const members = (await MemberModel.find({ workspaceId })
    .populate("role", "name")
    .select("userId role")
    .lean()) as unknown as MemberWithRole[];

  return members
    .filter(
      (member) =>
        member.role?.name === Roles.OWNER || member.role?.name === Roles.ADMIN
    )
    .map((member) => member.userId.toString());
};

const handleTaskAssignment = async (event: DomainEvent) => {
  const assignedTo =
    typeof event.metadata?.assignedTo === "string"
      ? event.metadata.assignedTo
      : null;
  const assignmentChanged = event.metadata?.assignmentChanged !== false;

  if (!assignedTo || !assignmentChanged) {
    return;
  }

  const task = await TaskModel.findOne({
    _id: event.entityId,
    workspace: event.context.workspaceId,
  })
    .select("_id title project")
    .lean();

  if (!task) {
    return;
  }

  const projectId = task.project.toString();
  const taskId = task._id.toString();

  await createNotificationsForRecipients(event.context, [assignedTo], {
    type: NotificationTypeEnum.TASK_ASSIGNED,
    category: NotificationCategoryEnum.TASK,
    entityType: DomainEntityTypeEnum.TASK,
    entityId: taskId,
    title: "Task assigned",
    body: summarize(task.title, "A task was assigned to you"),
    metadata: {
      projectId,
      taskId,
      path: getPathForTask(event.context.workspaceId, projectId, taskId),
    },
    dedupeKeyForRecipient: (recipientId) =>
      `task-assigned:${taskId}:${recipientId}:${event.context.requestId}`,
  });
};

const handleTaskWatcherMaterialUpdate = async (event: DomainEvent) => {
  const materialChangeTypes = asStringArray(event.metadata?.materialChangeTypes);
  const watchedChangeTypes = materialChangeTypes.filter((changeType) =>
    ["status", "assignee", "priority", "completed"].includes(changeType)
  );

  if (watchedChangeTypes.length === 0) {
    return;
  }

  const task = await TaskModel.findOne({
    _id: event.entityId,
    workspace: event.context.workspaceId,
  })
    .select("_id title project")
    .lean();

  if (!task) {
    return;
  }

  const watchers = await TaskWatcherModel.find({
    workspace: event.context.workspaceId,
    task: event.entityId,
    deletedAt: null,
  })
    .select("user")
    .lean();
  const recipientIds = watchers.map((watcher) => watcher.user.toString());
  const projectId = task.project.toString();
  const taskId = task._id.toString();
  const completed = watchedChangeTypes.includes("completed");

  await createNotificationsForRecipients(event.context, recipientIds, {
    type: NotificationTypeEnum.TASK_UPDATED,
    category: NotificationCategoryEnum.TASK,
    entityType: DomainEntityTypeEnum.TASK,
    entityId: taskId,
    title: completed ? "Task completed" : "Task updated",
    body: summarize(task.title, "A watched task changed"),
    metadata: {
      projectId,
      taskId,
      changedFields: watchedChangeTypes,
      path: getPathForTask(event.context.workspaceId, projectId, taskId),
    },
    dedupeKeyForRecipient: (recipientId) =>
      `task-updated:${taskId}:${recipientId}:${event.context.requestId}`,
  });
};

const handleProjectCreated = async (event: DomainEvent) => {
  const project = await ProjectModel.findOne({
    _id: event.entityId,
    workspace: event.context.workspaceId,
  })
    .select("_id name")
    .lean();

  if (!project) {
    return;
  }

  const projectId = project._id.toString();
  const recipients = await getOwnerAndAdminRecipientIds(
    event.context.workspaceId
  );

  await createNotificationsForRecipients(event.context, recipients, {
    type: NotificationTypeEnum.PROJECT_CREATED,
    category: NotificationCategoryEnum.PROJECT,
    entityType: DomainEntityTypeEnum.PROJECT,
    entityId: projectId,
    title: "Project created",
    body: summarize(project.name, "A project was created"),
    metadata: {
      projectId,
      path: getPathForProject(event.context.workspaceId, projectId),
    },
    dedupeKeyForRecipient: (recipientId) =>
      `project-created:${projectId}:${recipientId}`,
  });
};

const resolveCommentTarget = async (
  workspaceId: string,
  targetType: string,
  targetId: mongoose.Types.ObjectId
) => {
  if (targetType === CommentTargetTypeEnum.TASK) {
    const task = await TaskModel.findOne({
      _id: targetId,
      workspace: workspaceId,
    })
      .select("_id project title assignedTo createdBy")
      .lean();

    if (!task) {
      return null;
    }

    return {
      projectId: task.project.toString(),
      taskId: task._id.toString(),
      recipients: compactUnique([
        task.assignedTo?.toString(),
        task.createdBy.toString(),
      ]),
      path: getPathForTask(
        workspaceId,
        task.project.toString(),
        task._id.toString()
      ),
    };
  }

  const project = await ProjectModel.findOne({
    _id: targetId,
    workspace: workspaceId,
  })
    .select("_id createdBy name")
    .lean();

  if (!project) {
    return null;
  }

  return {
    projectId: project._id.toString(),
    taskId: null,
    recipients: compactUnique([project.createdBy.toString()]),
    path: getPathForProject(workspaceId, project._id.toString()),
  };
};

const handleCommentNotifications = async (event: DomainEvent) => {
  const comment = await CommentModel.findOne({
    _id: event.entityId,
    workspace: event.context.workspaceId,
    deletedAt: null,
  })
    .select(
      "_id author targetType targetId parentComment plainText mentions createdAt"
    )
    .lean();

  if (!comment) {
    return;
  }

  const commentId = comment._id.toString();
  const target = await resolveCommentTarget(
    event.context.workspaceId,
    comment.targetType,
    comment.targetId
  );

  if (!target) {
    return;
  }

  const mentionIds =
    event.type === DomainEventTypeEnum.COMMENT_UPDATED
      ? asStringArray(event.metadata?.newMentionIds)
      : asStringArray(event.metadata?.mentionIds);

  await createNotificationsForRecipients(event.context, mentionIds, {
    type: NotificationTypeEnum.MENTION_RECEIVED,
    category: NotificationCategoryEnum.COMMENT,
    entityType: DomainEntityTypeEnum.COMMENT,
    entityId: commentId,
    title: "You were mentioned",
    body: summarize(comment.plainText, "You were mentioned in a comment"),
    metadata: {
      commentId,
      targetType: comment.targetType,
      targetId: comment.targetId.toString(),
      projectId: target.projectId,
      taskId: target.taskId,
      path: target.path,
    },
    dedupeKeyForRecipient: (recipientId) =>
      `mention:${commentId}:${recipientId}:${event.context.requestId}`,
  });

  if (event.type !== DomainEventTypeEnum.COMMENT_CREATED) {
    return;
  }

  let commentRecipients = target.recipients;

  if (comment.parentComment) {
    const parent = await CommentModel.findOne({
      _id: comment.parentComment,
      workspace: event.context.workspaceId,
      deletedAt: null,
    })
      .select("author")
      .lean();

    commentRecipients = compactUnique([parent?.author?.toString()]);
  }

  const recipients = commentRecipients.filter(
    (recipientId) => !mentionIds.includes(recipientId)
  );

  await createNotificationsForRecipients(event.context, recipients, {
    type: NotificationTypeEnum.COMMENT_ADDED,
    category: NotificationCategoryEnum.COMMENT,
    entityType: DomainEntityTypeEnum.COMMENT,
    entityId: commentId,
    title: comment.parentComment ? "Reply added" : "Comment added",
    body: summarize(comment.plainText, "A comment was added"),
    metadata: {
      commentId,
      parentCommentId: comment.parentComment?.toString() ?? null,
      targetType: comment.targetType,
      targetId: comment.targetId.toString(),
      projectId: target.projectId,
      taskId: target.taskId,
      path: target.path,
    },
    dedupeKeyForRecipient: (recipientId) =>
      `comment-added:${commentId}:${recipientId}`,
  });
};

const handleInviteAccepted = async (event: DomainEvent) => {
  const joinedUserId =
    typeof event.metadata?.joinedUserId === "string"
      ? event.metadata.joinedUserId
      : null;

  if (!joinedUserId) {
    return;
  }

  const joinedUser = await UserModel.findById(joinedUserId)
    .select("name email")
    .lean();
  const recipients = await getOwnerAndAdminRecipientIds(
    event.context.workspaceId
  );

  await createNotificationsForRecipients(event.context, recipients, {
    type: NotificationTypeEnum.INVITE_ACCEPTED,
    category: NotificationCategoryEnum.INVITE,
    entityType: DomainEntityTypeEnum.MEMBER,
    entityId: event.entityId,
    title: "Invite accepted",
    body: `${joinedUser?.name || joinedUser?.email || "A member"} joined the workspace`,
    metadata: {
      joinedUserId,
      path: `/workspace/${event.context.workspaceId}/members`,
    },
    dedupeKeyForRecipient: (recipientId) =>
      `invite-accepted:${event.entityId}:${recipientId}`,
  });
};

const handleFileUploaded = async (event: DomainEvent) => {
  const file = await FileAssetModel.findOne({
    _id: event.entityId,
    workspace: event.context.workspaceId,
    deletedAt: null,
  })
    .select("_id targetType targetId safeName originalName")
    .lean();

  if (
    !file ||
    (file.targetType !== DomainEntityTypeEnum.TASK &&
      file.targetType !== DomainEntityTypeEnum.PROJECT)
  ) {
    return;
  }

  const target = await resolveCommentTarget(
    event.context.workspaceId,
    file.targetType,
    file.targetId
  );

  if (!target) {
    return;
  }

  const category =
    file.targetType === DomainEntityTypeEnum.TASK
      ? NotificationCategoryEnum.TASK
      : NotificationCategoryEnum.PROJECT;

  await createNotificationsForRecipients(event.context, target.recipients, {
    type: NotificationTypeEnum.FILE_UPLOADED,
    category,
    entityType: DomainEntityTypeEnum.FILE_ASSET,
    entityId: file._id.toString(),
    title: "File uploaded",
    body: summarize(file.safeName || file.originalName, "A file was uploaded"),
    metadata: {
      fileId: file._id.toString(),
      targetType: file.targetType,
      targetId: file.targetId.toString(),
      projectId: target.projectId,
      taskId: target.taskId,
      path: target.path,
    },
    dedupeKeyForRecipient: (recipientId) =>
      `file-uploaded:${file._id.toString()}:${recipientId}`,
  });
};

let registered = false;

export const registerNotificationEventHandlers = () => {
  if (registered) {
    return;
  }

  registered = true;
  registerDomainEventHandler(DomainEventTypeEnum.TASK_CREATED, handleTaskAssignment);
  registerDomainEventHandler(DomainEventTypeEnum.TASK_UPDATED, handleTaskAssignment);
  registerDomainEventHandler(
    DomainEventTypeEnum.TASK_UPDATED,
    handleTaskWatcherMaterialUpdate
  );
  registerDomainEventHandler(
    DomainEventTypeEnum.PROJECT_CREATED,
    handleProjectCreated
  );
  registerDomainEventHandler(
    DomainEventTypeEnum.COMMENT_CREATED,
    handleCommentNotifications
  );
  registerDomainEventHandler(
    DomainEventTypeEnum.COMMENT_UPDATED,
    handleCommentNotifications
  );
  registerDomainEventHandler(DomainEventTypeEnum.MEMBER_JOINED, handleInviteAccepted);
  registerDomainEventHandler(DomainEventTypeEnum.FILE_UPLOADED, handleFileUploaded);
};

export const resetNotificationEventHandlersForTest = () => {
  registered = false;
};
