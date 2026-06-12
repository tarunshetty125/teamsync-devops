export const TaskStatusEnum = {
  BACKLOG: "BACKLOG",
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  IN_REVIEW: "IN_REVIEW",
  DONE: "DONE",
} as const;

export const TaskPriorityEnum = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
} as const;

export const TaskDependencyTypeEnum = {
  FINISH_TO_START: "FINISH_TO_START",
} as const;

export const TaskWatcherSourceEnum = {
  MANUAL: "MANUAL",
  CREATOR: "CREATOR",
  ASSIGNEE: "ASSIGNEE",
} as const;

export const TaskRecurrenceFrequencyEnum = {
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
} as const;

export type TaskStatusEnumType = keyof typeof TaskStatusEnum;
export type TaskPriorityEnumType = keyof typeof TaskPriorityEnum;
export type TaskDependencyTypeEnumType =
  (typeof TaskDependencyTypeEnum)[keyof typeof TaskDependencyTypeEnum];
export type TaskWatcherSourceEnumType =
  (typeof TaskWatcherSourceEnum)[keyof typeof TaskWatcherSourceEnum];
export type TaskRecurrenceFrequencyEnumType =
  (typeof TaskRecurrenceFrequencyEnum)[keyof typeof TaskRecurrenceFrequencyEnum];
