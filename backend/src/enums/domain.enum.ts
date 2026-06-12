export const DomainEntityTypeEnum = {
  WORKSPACE: "WORKSPACE",
  USER: "USER",
  MEMBER: "MEMBER",
  PROJECT: "PROJECT",
  TASK: "TASK",
  TASK_DEPENDENCY: "TASK_DEPENDENCY",
  TASK_WATCHER: "TASK_WATCHER",
  COMMENT: "COMMENT",
  MENTION: "MENTION",
  FILE_ASSET: "FILE_ASSET",
  NOTIFICATION: "NOTIFICATION",
  LABEL: "LABEL",
  MILESTONE: "MILESTONE",
  TIME_ENTRY: "TIME_ENTRY",
  ROLE: "ROLE",
  WORKSPACE_POLICY: "WORKSPACE_POLICY",
  EXPORT_JOB: "EXPORT_JOB",
  SESSION: "SESSION",
  LOGIN_EVENT: "LOGIN_EVENT",
} as const;

export type DomainEntityType =
  (typeof DomainEntityTypeEnum)[keyof typeof DomainEntityTypeEnum];

export const AuditActionEnum = {
  CREATED: "CREATED",
  UPDATED: "UPDATED",
  DELETED: "DELETED",
  RESTORED: "RESTORED",
  VIEWED: "VIEWED",
  EXPORTED: "EXPORTED",
  PERMISSION_CHANGED: "PERMISSION_CHANGED",
} as const;

export type AuditActionType =
  (typeof AuditActionEnum)[keyof typeof AuditActionEnum];

export const ActivityTypeEnum = {
  WORKSPACE_CREATED: "WORKSPACE_CREATED",
  PROJECT_CREATED: "PROJECT_CREATED",
  PROJECT_UPDATED: "PROJECT_UPDATED",
  TASK_CREATED: "TASK_CREATED",
  TASK_UPDATED: "TASK_UPDATED",
  TASK_SCHEDULE_UPDATED: "TASK_SCHEDULE_UPDATED",
  SUBTASK_CREATED: "SUBTASK_CREATED",
  CHECKLIST_UPDATED: "CHECKLIST_UPDATED",
  TASK_DEPENDENCY_UPDATED: "TASK_DEPENDENCY_UPDATED",
  TASK_WATCHER_UPDATED: "TASK_WATCHER_UPDATED",
  TASK_RECURRENCE_UPDATED: "TASK_RECURRENCE_UPDATED",
  COMMENT_CREATED: "COMMENT_CREATED",
  COMMENT_UPDATED: "COMMENT_UPDATED",
  COMMENT_DELETED: "COMMENT_DELETED",
  FILE_UPLOADED: "FILE_UPLOADED",
  FILE_DELETED: "FILE_DELETED",
  MEMBER_JOINED: "MEMBER_JOINED",
  MILESTONE_CREATED: "MILESTONE_CREATED",
  MILESTONE_UPDATED: "MILESTONE_UPDATED",
  MILESTONE_DELETED: "MILESTONE_DELETED",
  TIMER_STARTED: "TIMER_STARTED",
  TIMER_STOPPED: "TIMER_STOPPED",
  TIME_ENTRY_CREATED: "TIME_ENTRY_CREATED",
  TIME_ENTRY_UPDATED: "TIME_ENTRY_UPDATED",
  TIME_ENTRY_DELETED: "TIME_ENTRY_DELETED",
  CAPACITY_UPDATED: "CAPACITY_UPDATED",
} as const;

export type ActivityType =
  (typeof ActivityTypeEnum)[keyof typeof ActivityTypeEnum];

export const NotificationTypeEnum = {
  TASK_ASSIGNED: "TASK_ASSIGNED",
  COMMENT_ADDED: "COMMENT_ADDED",
  MENTION_RECEIVED: "MENTION_RECEIVED",
  PROJECT_CREATED: "PROJECT_CREATED",
  INVITE_ACCEPTED: "INVITE_ACCEPTED",
  FILE_UPLOADED: "FILE_UPLOADED",
  TASK_UPDATED: "TASK_UPDATED",
} as const;

export type NotificationType =
  (typeof NotificationTypeEnum)[keyof typeof NotificationTypeEnum];

export const NotificationCategoryEnum = {
  TASK: "TASK",
  PROJECT: "PROJECT",
  COMMENT: "COMMENT",
  INVITE: "INVITE",
  SYSTEM: "SYSTEM",
} as const;

export type NotificationCategory =
  (typeof NotificationCategoryEnum)[keyof typeof NotificationCategoryEnum];

export const FileAssetStatusEnum = {
  AVAILABLE: "AVAILABLE",
  DELETED: "DELETED",
  QUARANTINED: "QUARANTINED",
} as const;

export type FileAssetStatusType =
  (typeof FileAssetStatusEnum)[keyof typeof FileAssetStatusEnum];

export const FileStorageProviderEnum = {
  LOCAL: "LOCAL",
} as const;

export type FileStorageProviderType =
  (typeof FileStorageProviderEnum)[keyof typeof FileStorageProviderEnum];

export const CommentTargetTypeEnum = {
  TASK: "TASK",
  PROJECT: "PROJECT",
} as const;

export type CommentTargetType =
  (typeof CommentTargetTypeEnum)[keyof typeof CommentTargetTypeEnum];

export const MilestoneStatusEnum = {
  PLANNED: "PLANNED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
} as const;

export type MilestoneStatusType =
  (typeof MilestoneStatusEnum)[keyof typeof MilestoneStatusEnum];

export const TimeEntrySourceEnum = {
  TIMER: "TIMER",
  MANUAL: "MANUAL",
} as const;

export type TimeEntrySourceType =
  (typeof TimeEntrySourceEnum)[keyof typeof TimeEntrySourceEnum];

export const DomainEventTypeEnum = {
  TASK_CREATED: "task.created",
  TASK_UPDATED: "task.updated",
  TASK_DELETED: "task.deleted",
  SUBTASK_CREATED: "subtask.created",
  COMMENT_CREATED: "comment.created",
  COMMENT_UPDATED: "comment.updated",
  COMMENT_DELETED: "comment.deleted",
  FILE_UPLOADED: "file.uploaded",
  FILE_DELETED: "file.deleted",
  NOTIFICATION_CREATED: "notification.created",
  MEMBER_JOINED: "member.joined",
  PROJECT_CREATED: "project.created",
  MILESTONE_CREATED: "milestone.created",
  TIME_ENTRY_CREATED: "timeEntry.created",
  TIME_ENTRY_UPDATED: "timeEntry.updated",
  TIME_ENTRY_DELETED: "timeEntry.deleted",
} as const;

export type DomainEventType =
  (typeof DomainEventTypeEnum)[keyof typeof DomainEventTypeEnum];
