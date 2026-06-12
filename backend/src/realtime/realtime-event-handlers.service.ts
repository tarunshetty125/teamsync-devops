import {
  CommentTargetTypeEnum,
  DomainEventTypeEnum,
} from "../enums/domain.enum";
import CommentModel from "../models/comment.model";
import ProjectModel from "../models/project.model";
import TaskModel from "../models/task.model";
import {
  DomainEvent,
  registerDomainEventHandler,
} from "../services/domain-event.service";
import { realtimeService } from "./realtime.service";

type TaskPayloadContext = {
  taskId: string;
  workspaceId: string;
  projectId: string;
  changedFields?: string[];
  timestamp: string;
};

type CommentPayloadContext = {
  commentId: string;
  workspaceId: string;
  projectId: string;
  taskId: string | null;
  timestamp: string;
};

const getStringMetadata = (
  metadata: Record<string, unknown> | undefined,
  key: string
) => {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
};

const getChangedFields = (metadata: Record<string, unknown> | undefined) => {
  const value = metadata?.changedFields;

  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((field): field is string => typeof field === "string");
};

const resolveTaskPayload = async (
  event: DomainEvent
): Promise<TaskPayloadContext | null> => {
  const workspaceId = event.context.workspaceId;
  const taskId = event.entityId;
  let projectId = getStringMetadata(event.metadata, "projectId");

  if (!projectId) {
    const task = await TaskModel.findOne({
      _id: taskId,
      workspace: workspaceId,
    })
      .select("project")
      .lean();

    projectId = task?.project?.toString() || null;
  }

  if (!projectId) {
    return null;
  }

  return {
    taskId,
    workspaceId,
    projectId,
    changedFields: getChangedFields(event.metadata),
    timestamp: event.occurredAt.toISOString(),
  };
};

const resolveCommentPayload = async (
  event: DomainEvent
): Promise<CommentPayloadContext | null> => {
  const workspaceId = event.context.workspaceId;
  const comment = await CommentModel.findOne({
    _id: event.entityId,
    workspace: workspaceId,
  })
    .select("targetType targetId")
    .lean();

  const targetType =
    comment?.targetType || getStringMetadata(event.metadata, "targetType");
  const targetId =
    comment?.targetId?.toString() || getStringMetadata(event.metadata, "targetId");

  if (!targetType || !targetId) {
    return null;
  }

  if (targetType === CommentTargetTypeEnum.TASK) {
    const task = await TaskModel.findOne({
      _id: targetId,
      workspace: workspaceId,
    })
      .select("_id project")
      .lean();

    if (!task) {
      return null;
    }

    return {
      commentId: event.entityId,
      workspaceId,
      projectId: task.project.toString(),
      taskId: task._id.toString(),
      timestamp: event.occurredAt.toISOString(),
    };
  }

  if (targetType === CommentTargetTypeEnum.PROJECT) {
    const project = await ProjectModel.findOne({
      _id: targetId,
      workspace: workspaceId,
    })
      .select("_id")
      .lean();

    if (!project) {
      return null;
    }

    return {
      commentId: event.entityId,
      workspaceId,
      projectId: project._id.toString(),
      taskId: null,
      timestamp: event.occurredAt.toISOString(),
    };
  }

  return null;
};

const handleTaskCreated = async (event: DomainEvent) => {
  const payload = await resolveTaskPayload(event);
  if (payload) realtimeService.emitTaskCreated(payload);
};

const handleTaskUpdated = async (event: DomainEvent) => {
  const payload = await resolveTaskPayload(event);
  if (payload) realtimeService.emitTaskUpdated(payload);
};

const handleTaskDeleted = async (event: DomainEvent) => {
  const payload = await resolveTaskPayload(event);
  if (payload) realtimeService.emitTaskDeleted(payload);
};

const handleCommentCreated = async (event: DomainEvent) => {
  const payload = await resolveCommentPayload(event);
  if (payload) realtimeService.emitCommentCreated(payload);
};

const handleCommentUpdated = async (event: DomainEvent) => {
  const payload = await resolveCommentPayload(event);
  if (payload) realtimeService.emitCommentUpdated(payload);
};

const handleCommentDeleted = async (event: DomainEvent) => {
  const payload = await resolveCommentPayload(event);
  if (payload) realtimeService.emitCommentDeleted(payload);
};

const handleNotificationCreated = (event: DomainEvent) => {
  const recipientId = getStringMetadata(event.metadata, "recipientId");
  const category = getStringMetadata(event.metadata, "category");

  if (!recipientId || !category) {
    return;
  }

  realtimeService.emitNotificationCreated({
    notificationId: event.entityId,
    recipientId,
    category,
    timestamp: event.occurredAt.toISOString(),
  });
};

let registered = false;

export const registerRealtimeEventHandlers = () => {
  if (registered) {
    return;
  }

  registered = true;
  registerDomainEventHandler(DomainEventTypeEnum.TASK_CREATED, handleTaskCreated);
  registerDomainEventHandler(DomainEventTypeEnum.TASK_UPDATED, handleTaskUpdated);
  registerDomainEventHandler(DomainEventTypeEnum.TASK_DELETED, handleTaskDeleted);
  registerDomainEventHandler(
    DomainEventTypeEnum.COMMENT_CREATED,
    handleCommentCreated
  );
  registerDomainEventHandler(
    DomainEventTypeEnum.COMMENT_UPDATED,
    handleCommentUpdated
  );
  registerDomainEventHandler(
    DomainEventTypeEnum.COMMENT_DELETED,
    handleCommentDeleted
  );
  registerDomainEventHandler(
    DomainEventTypeEnum.NOTIFICATION_CREATED,
    handleNotificationCreated
  );
};

export const resetRealtimeEventHandlersForTest = () => {
  registered = false;
};
