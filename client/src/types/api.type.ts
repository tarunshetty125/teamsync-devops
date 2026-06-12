import {
  PermissionType,
  TaskPriorityEnumType,
  TaskStatusEnumType,
} from "@/constant";

export type loginType = { email: string; password: string };
export type LoginResponseType = {
  message: string;
  user: {
    _id: string;
    currentWorkspace: string;
  };
};

export type registerType = {
  name: string;
  email: string;
  password: string;
};

// USER TYPE
export type UserType = {
  _id: string;
  name: string;
  email: string;
  profilePicture: string | null;
  bio?: string | null;
  timezone?: string | null;
  preferences?: Record<string, unknown>;
  isActive: true;
  lastLogin: null;
  createdAt: Date;
  updatedAt: Date;
  currentWorkspace: {
    _id: string;
    name: string;
    owner: string;
    inviteCode: string;
  };
};

export type CurrentUserResponseType = {
  message: string;
  user: UserType;
};

//******** */ WORLSPACE TYPES ****************
// ******************************************
export type WorkspaceType = {
  _id: string;
  name: string;
  description?: string;
  owner: string;
  inviteCode: string;
};

export type CreateWorkspaceType = {
  name: string;
  description: string;
};

export type EditWorkspaceType = {
  workspaceId: string;
  data: {
    name: string;
    description: string;
  };
};

export type CreateWorkspaceResponseType = {
  message: string;
  workspace: WorkspaceType;
};

export type AllWorkspaceResponseType = {
  message: string;
  workspaces: WorkspaceType[];
};

export type WorkspaceWithMembersType = WorkspaceType & {
  members: {
    _id: string;
    userId: string;
    workspaceId: string;
    role: {
      _id: string;
      name: string;
      permissions: PermissionType[];
      isSystem?: boolean;
    };
    capacityHoursPerWeek?: number;
    status?: "ACTIVE" | "DEACTIVATED";
    lastActiveAt?: string | null;
    deactivatedAt?: string | null;
    joinedAt: string;
    createdAt: string;
  }[];
};

export type WorkspaceByIdResponseType = {
  message: string;
  workspace: WorkspaceWithMembersType;
};

export type ChangeWorkspaceMemberRoleType = {
  workspaceId: string;
  data: {
    roleId: string;
    memberId: string;
  };
};

export type AllMembersInWorkspaceResponseType = {
  message: string;
  members: {
    _id: string;
    userId: {
      _id: string;
      name: string;
      email: string;
      profilePicture: string | null;
    };
    workspaceId: string;
    role: {
      _id: string;
      name: string;
      permissions?: PermissionType[];
      isSystem?: boolean;
    };
    capacityHoursPerWeek?: number;
    status?: "ACTIVE" | "DEACTIVATED";
    lastActiveAt?: string | null;
    deactivatedAt?: string | null;
    joinedAt: string;
    createdAt: string;
  }[];
  roles: RoleType[];
};

export type AnalyticsResponseType = {
  message: string;
  analytics: {
    totalTasks: number;
    overdueTasks: number;
    completedTasks: number;
  };
};

export type PaginationType = {
  totalCount: number;
  pageSize: number;
  pageNumber: number;
  totalPages: number;
  skip: number;
  limit: number;
};

export type RoleType = {
  _id: string;
  name: string;
  description?: string | null;
  permissions?: PermissionType[];
  isSystem?: boolean;
};

export type SearchResultTypeEnumType =
  | "PROJECT"
  | "TASK"
  | "COMMENT"
  | "MEMBER";

export type SearchResultItemType = {
  id: string;
  type: SearchResultTypeEnumType;
  entityId: string;
  title: string;
  subtitle: string;
  snippet: string;
  url: string;
  updatedAt: string;
  canView: true;
  projectId?: string;
  taskId?: string;
  commentId?: string;
  memberId?: string;
  avatarUrl?: string | null;
};

export type SearchGroupType = {
  type: SearchResultTypeEnumType;
  totalCount: number;
  results: SearchResultItemType[];
};

export type SearchPreviewPayloadType = {
  workspaceId: string;
  q: string;
  types?: SearchResultTypeEnumType[];
  limitPerType?: number;
};

export type SearchPreviewResponseType = {
  message: string;
  groups: SearchGroupType[];
};

export type SearchTypePayloadType = {
  workspaceId: string;
  type: SearchResultTypeEnumType;
  q: string;
  pageNumber?: number;
  pageSize?: number;
};

export type SearchTypeResponseType = {
  message: string;
  type: SearchResultTypeEnumType;
  results: SearchResultItemType[];
  pagination: PaginationType;
};
// *********** MEMBER ****************

//******** */ PROJECT TYPES ****************
//****************************************** */
export type ProjectType = {
  _id: string;
  name: string;
  emoji: string;
  description: string;
  workspace: string;
  createdBy: {
    _id: string;
    name: string;
    profilePicture: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectPayloadType = {
  workspaceId: string;
  data: {
    emoji: string;
    name: string;
    description: string;
  };
};

export type ProjectResponseType = {
  message: "Project created successfully";
  project: ProjectType;
};

export type EditProjectPayloadType = {
  workspaceId: string;
  projectId: string;
  data: {
    emoji: string;
    name: string;
    description: string;
  };
};

//ALL PROJECTS IN WORKSPACE TYPE
export type AllProjectPayloadType = {
  workspaceId: string;
  pageNumber?: number;
  pageSize?: number;
  keyword?: string;
  skip?: boolean;
};

export type AllProjectResponseType = {
  message: string;
  projects: ProjectType[];
  pagination: PaginationType;
};

// SINGLE PROJECT IN WORKSPACE TYPE
export type ProjectByIdPayloadType = {
  workspaceId: string;
  projectId: string;
};

//********** */ TASK TYPES ************************
//************************************************* */

export type CreateTaskPayloadType = {
  workspaceId: string;
  projectId: string;
  data: {
    title: string;
    description: string;
    priority: TaskPriorityEnumType;
    status: TaskStatusEnumType;
    assignedTo: string;
    dueDate: string;
  };
};


//added new for edtiting of task
export type EditTaskPayloadType = {
  taskId: string;
  workspaceId: string;
  projectId: string;
  data: Partial<{
    title: string;
    description: string;
    priority: TaskPriorityEnumType;
    status: TaskStatusEnumType;
    assignedTo: string;
    dueDate: string;
  }>;
};


export type TaskType = {
  _id: string;
  title: string;
  description?: string;
  project?: {
    _id: string;
    emoji: string;
    name: string;
  };
  priority: TaskPriorityEnumType;
  status: TaskStatusEnumType;
  assignedTo: {
    _id: string;
    name: string;
    profilePicture: string | null;
  } | null;
  createdBy?: string;
  startDate?: string | null;
  endDate?: string | null;
  dueDate: string;
  completedAt?: string | null;
  taskCode: string;
  parentTask?: string | null;
  rootTask?: string | null;
  subtaskDepth?: number;
  subtaskOrder?: number;
  labels?: LabelType[];
  checklist?: ChecklistItemType[];
  recurrence?: TaskRecurrenceType;
  generatedFromTaskId?: string | null;
  dependencySummary?: DependencySummaryType;
  createdAt?: string;
  updatedAt?: string;
};

export type AllTaskPayloadType = {
  workspaceId: string;
  projectId?: string | null;
  keyword?: string | null;
  priority?: TaskPriorityEnumType | null;
  status?: TaskStatusEnumType | null;
  assignedTo?: string | null;
  dueDate?: string | null;
  dueDateFrom?: string | null;
  dueDateTo?: string | null;
  pageNumber?: number | null;
  pageSize?: number | null;
};

export type AllTaskResponseType = {
  message: string;
  tasks: TaskType[];
  pagination: PaginationType;
};

export type KanbanTaskType = TaskType & {
  isBlocked: boolean;
  blockedByCount: number;
};

export type KanbanColumnType = {
  status: TaskStatusEnumType;
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
  tasks: KanbanTaskType[];
};

export type KanbanPayloadType = {
  workspaceId: string;
  projectId?: string | null;
  keyword?: string | null;
  priority?: TaskPriorityEnumType | null;
  assignedTo?: string | null;
  labelIds?: string | null;
  status?: TaskStatusEnumType | null;
  cursor?: string | null;
  columnLimit?: number | null;
};

export type KanbanResponseType = {
  message: string;
  columns: KanbanColumnType[];
  columnCounts: Record<TaskStatusEnumType, number>;
};

export type TaskResponseType = {
  message: string;
  task: TaskType;
};

export type DashboardRangeType = "7d" | "14d" | "30d" | "90d";

export type DashboardTaskItemType = Pick<
  TaskType,
  | "_id"
  | "taskCode"
  | "title"
  | "status"
  | "priority"
  | "dueDate"
  | "completedAt"
  | "updatedAt"
  | "project"
  | "assignedTo"
>;

export type PersonalDashboardResponseType = {
  message: string;
  dashboard: {
    range: DashboardRangeType;
    summary: {
      assignedOpenTasks: number;
      dueToday: number;
      overdue: number;
      upcoming: number;
    };
    dueTodayTasks: DashboardTaskItemType[];
    overdueTasks: DashboardTaskItemType[];
    upcomingTasks: DashboardTaskItemType[];
    recentlyUpdatedTasks: DashboardTaskItemType[];
  };
};

export type TeamDashboardResponseType = {
  message: string;
  dashboard: {
    range: DashboardRangeType;
    summary: {
      totalTasks: number;
      completedTasks: number;
      openTasks: number;
      unassignedOpenTasks: number;
      completionRate: number;
    };
    workload: {
      memberId: string;
      userId: string;
      name: string;
      email: string;
      profilePicture: string | null;
      role: string;
      openTasks: number;
    }[];
    statusDistribution: {
      status: TaskStatusEnumType;
      count: number;
    }[];
    projectProgress: {
      projectId: string;
      name: string;
      emoji: string;
      totalTasks: number;
      completedTasks: number;
      openTasks: number;
      completionRate: number;
    }[];
  };
};

export type ExecutiveDashboardResponseType = {
  message: string;
  dashboard: {
    range: DashboardRangeType;
    summary: {
      totalProjects: number;
      totalMembers: number;
      totalTasks: number;
      completedTasks: number;
      openTasks: number;
      overdueOpenTasks: number;
      blockedOpenTasks: number;
      completionRate: number;
    };
    projectHealth: {
      projectId: string;
      name: string;
      emoji: string;
      totalTasks: number;
      completedTasks: number;
      openTasks: number;
      overdueOpenTasks: number;
      blockedOpenTasks: number;
      completionRate: number;
      health: {
        score: number;
        status: "HEALTHY" | "AT_RISK" | "CRITICAL";
      };
    }[];
    completionTrend: {
      date: string;
      count: number;
    }[];
    velocity: {
      completedInRange: number;
      averageCompletedPerDay: number;
      buckets: {
        date: string;
        count: number;
      }[];
    };
    productivity: {
      overdueOpenRate: number;
      blockedOpenRate: number;
      averageCompletedPerDay: number;
    };
    workspaceHealth: {
      totalMembers: number;
      activeMembers: number;
      inactiveMembers: number;
      totalProjects: number;
      totalTasks: number;
      completedTasks: number;
      completionRate: number;
      collaboration: {
        commentVolume: number;
        fileUploads: number;
        notificationVolume: number;
      };
      productivity: {
        trackedHours: number;
        activeTimers: number;
        trackedSeconds: number;
        capacitySeconds: number;
        capacityUtilizationPercent: number;
      };
      storage: {
        fileCount: number;
        storageUsedBytes: number;
      };
    };
  };
};

export type ProductivityRangeType = DashboardRangeType;

export type TimeEntryUserType = {
  _id: string;
  name: string;
  email: string;
  profilePicture: string | null;
};

export type TimeEntryType = {
  _id: string;
  workspace: string;
  user: string | TimeEntryUserType;
  task: string | null;
  project: string | null;
  taskTitle: string | null;
  taskCode: string | null;
  projectName: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  currentDurationSeconds: number;
  note: string | null;
  source: "TIMER" | "MANUAL";
  createdAt: string;
  updatedAt: string;
};

export type ActiveTimerResponseType = {
  message: string;
  activeTimer: TimeEntryType | null;
};

export type StartTimerPayloadType = {
  workspaceId: string;
  data: {
    taskId?: string | null;
    projectId?: string | null;
    note?: string | null;
  };
};

export type StartTimerResponseType = {
  message: string;
  activeTimer: TimeEntryType | null;
  startedAt?: string;
  taskId?: string;
  projectId?: string;
};

export type TimeEntryMutationPayloadType = {
  workspaceId: string;
  data: {
    taskId?: string | null;
    projectId?: string | null;
    startedAt: string;
    endedAt: string;
    note?: string | null;
  };
};

export type UpdateTimeEntryPayloadType = {
  workspaceId: string;
  entryId: string;
  data: Partial<{
    taskId: string | null;
    projectId: string | null;
    startedAt: string;
    endedAt: string;
    note: string | null;
  }>;
};

export type TimeEntryListPayloadType = {
  workspaceId: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  projectId?: string;
  taskId?: string;
  pageNumber?: number;
  pageSize?: number;
};

export type TimeEntryListResponseType = {
  message: string;
  range: {
    startDate: string;
    endDate: string;
  };
  timeEntries: TimeEntryType[];
  pagination: PaginationType;
};

export type TimesheetResponseType = {
  message: string;
  timesheet: {
    range: {
      startDate: string;
      endDate: string;
    };
    totalSeconds: number;
    days: {
      date: string;
      totalSeconds: number;
      entries: TimeEntryType[];
    }[];
    users: {
      userId: string;
      name: string;
      email: string;
      profilePicture: string | null;
      totalSeconds: number;
    }[];
  };
};

export type ProductivityMemberMetricType = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  profilePicture: string | null;
  role: string;
  trackedSeconds: number;
};

export type ProductivityWorkloadResponseType = {
  message: string;
  workload: {
    range: ProductivityRangeType;
    rangeDays: number;
    startDate: string;
    endDate: string;
    members: (ProductivityMemberMetricType & {
      openTasks: number;
    })[];
  };
};

export type ProductivityCapacityResponseType = {
  message: string;
  capacity: {
    range: ProductivityRangeType;
    rangeDays: number;
    startDate: string;
    endDate: string;
    members: (ProductivityMemberMetricType & {
      capacityHoursPerWeek: number;
      capacitySeconds: number;
      utilizationPercent: number;
    })[];
  };
};

export type UpdateCapacityPayloadType = {
  workspaceId: string;
  memberId: string;
  data: {
    capacityHoursPerWeek: number;
  };
};

export type LabelType = {
  _id: string;
  workspace: string;
  name: string;
  color: string;
  description?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ChecklistItemType = {
  _id: string;
  text: string;
  order: number;
  completed: boolean;
  completedAt?: string | null;
  completedBy?: string | null;
  createdBy: string;
};

export type TaskRecurrenceType = {
  enabled: boolean;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  interval: number;
  endsAt?: string | null;
  maxOccurrences?: number | null;
  occurrenceIndex: number;
  seriesRoot?: string | null;
  previousOccurrence?: string | null;
};

export type DependencySummaryType = {
  blockingCount: number;
  blockedByCount: number;
  incompleteBlockingCount: number;
  isBlocked: boolean;
};

export type TaskDependencyType = {
  _id: string;
  workspace: string;
  predecessorTask: TaskType;
  successorTask: TaskType;
  type: "FINISH_TO_START";
};

export type TaskWatcherType = {
  _id: string;
  workspace: string;
  task: string;
  user: {
    _id: string;
    name: string;
    email: string;
    profilePicture: string | null;
  };
  source: "MANUAL" | "CREATOR" | "ASSIGNEE";
};

export type LabelListPayloadType = {
  workspaceId: string;
  pageNumber?: number;
  pageSize?: number;
};

export type LabelListResponseType = {
  message: string;
  labels: LabelType[];
  pagination: PaginationType;
};

export type CreateLabelPayloadType = {
  workspaceId: string;
  data: {
    name: string;
    color: string;
    description?: string | null;
  };
};

export type UpdateLabelPayloadType = {
  workspaceId: string;
  labelId: string;
  data: Partial<{
    name: string;
    color: string;
    description: string | null;
  }>;
};

export type DeleteLabelPayloadType = {
  workspaceId: string;
  labelId: string;
};

export type CreateSubtaskPayloadType = {
  workspaceId: string;
  parentTaskId: string;
  data: {
    title: string;
    description?: string;
    priority?: TaskPriorityEnumType;
    assignedTo?: string | null;
    dueDate?: string;
  };
};

export type SubtaskListPayloadType = {
  workspaceId: string;
  parentTaskId: string;
};

export type SubtaskListResponseType = {
  message: string;
  subtasks: TaskType[];
};

export type ChecklistPayloadType = {
  workspaceId: string;
  taskId: string;
};

export type AddChecklistItemPayloadType = ChecklistPayloadType & {
  text: string;
};

export type UpdateChecklistItemPayloadType = ChecklistPayloadType & {
  itemId: string;
  data: Partial<{
    text: string;
    completed: boolean;
  }>;
};

export type DeleteChecklistItemPayloadType = ChecklistPayloadType & {
  itemId: string;
};

export type ChecklistResponseType = {
  message: string;
  checklist: ChecklistItemType[];
};

export type ReplaceTaskLabelsPayloadType = ChecklistPayloadType & {
  labelIds: string[];
};

export type TaskDependencyListPayloadType = ChecklistPayloadType;

export type TaskDependencyListResponseType = {
  message: string;
  dependencies: TaskDependencyType[];
  dependencySummary: DependencySummaryType;
};

export type AddTaskDependencyPayloadType = ChecklistPayloadType & {
  predecessorTaskId: string;
};

export type RemoveTaskDependencyPayloadType = {
  workspaceId: string;
  dependencyId: string;
};

export type TaskWatcherListResponseType = {
  message: string;
  watchers: TaskWatcherType[];
};

export type AddTaskWatcherPayloadType = ChecklistPayloadType & {
  userId: string;
};

export type RemoveTaskWatcherPayloadType = ChecklistPayloadType & {
  userId: string;
};

export type TaskRecurrencePayloadType = ChecklistPayloadType & {
  data: {
    enabled: true;
    frequency: "DAILY" | "WEEKLY" | "MONTHLY";
    interval: number;
    endsAt?: string | null;
    maxOccurrences?: number | null;
  };
};

export type UpdateTaskSchedulePayloadType = ChecklistPayloadType & {
  data: {
    startDate: string | null;
    endDate: string | null;
  };
};

export type CommentTargetType = "TASK" | "PROJECT";

export type CommentUserType = {
  _id: string;
  name?: string;
  email?: string;
  profilePicture?: string | null;
};

export type CommentBodyJsonType = Record<string, unknown>;

export type CommentType = {
  _id: string;
  workspace: string;
  author: CommentUserType | string;
  targetType: CommentTargetType;
  targetId: string;
  parentComment: string | null;
  bodyJson: CommentBodyJsonType;
  plainText: string;
  mentions: string[];
  editedAt?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  replyCount?: number;
  replies: CommentType[];
};

export type CommentMutationPayloadType = {
  workspaceId: string;
  bodyJson: CommentBodyJsonType;
  plainText: string;
};

export type CreateCommentPayloadType = CommentMutationPayloadType & {
  targetType: CommentTargetType;
  targetId: string;
};

export type CreateReplyPayloadType = CommentMutationPayloadType & {
  commentId: string;
};

export type EditCommentPayloadType = CommentMutationPayloadType & {
  commentId: string;
};

export type DeleteCommentPayloadType = {
  workspaceId: string;
  commentId: string;
};

export type CommentListPayloadType = {
  workspaceId: string;
  targetType: CommentTargetType;
  targetId: string;
  pageNumber?: number;
  pageSize?: number;
};

export type CommentRepliesPayloadType = {
  workspaceId: string;
  commentId: string;
  pageNumber?: number;
  pageSize?: number;
};

export type CommentListResponseType = {
  message: string;
  comments: CommentType[];
  pagination: PaginationType;
};

export type CommentRepliesResponseType = {
  message: string;
  replies: CommentType[];
  pagination: PaginationType;
};

export type CommentResponseType = {
  message: string;
  comment: CommentType;
};

export type ReplyResponseType = {
  message: string;
  reply: CommentType;
};

export type ActivityType = {
  _id: string;
  workspace: string;
  actor: CommentUserType | string;
  type: string;
  entityType: string;
  entityId: string;
  project?: string | null;
  task?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  requestId: string;
  createdAt: string;
  updatedAt: string;
};

export type ActivityFeedPayloadType = {
  workspaceId: string;
  targetType?: CommentTargetType;
  targetId?: string;
  pageNumber?: number;
  pageSize?: number;
};

export type ActivityFeedResponseType = {
  message: string;
  activities: ActivityType[];
  pagination: PaginationType;
};

export type FileTargetType = "TASK" | "PROJECT";

export type FileAssetType = {
  _id: string;
  workspace: string;
  owner: string;
  targetType: FileTargetType | "USER";
  targetId: string;
  originalName: string;
  safeName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  status: "AVAILABLE" | "DELETED" | "QUARANTINED";
  metadata?: {
    kind?: "image" | "pdf";
    extension?: string;
    avatar?: boolean;
  };
  createdAt: string;
  updatedAt: string;
  previewPath: string;
  downloadPath: string;
};

export type FileListPayloadType = {
  workspaceId: string;
  targetType: FileTargetType;
  targetId: string;
  pageNumber?: number;
  pageSize?: number;
};

export type FileUploadPayloadType = {
  workspaceId: string;
  targetType: FileTargetType;
  targetId: string;
  file: File;
};

export type AvatarUploadPayloadType = {
  workspaceId: string;
  file: File;
};

export type FileDeletePayloadType = {
  workspaceId: string;
  fileId: string;
};

export type FileListResponseType = {
  message: string;
  files: FileAssetType[];
  pagination: PaginationType;
};

export type FileResponseType = {
  message: string;
  file: FileAssetType;
};

export type AvatarUploadResponseType = FileResponseType & {
  profilePicture: string;
};

export type UpdateProfilePayloadType = {
  name: string;
  bio?: string | null;
  timezone: string;
};

export type UpdateEmailPayloadType = {
  email: string;
  currentPassword: string;
};

export type UpdatePasswordPayloadType = {
  currentPassword: string;
  newPassword: string;
};

export type AccountSummaryResponseType = {
  message: string;
  providers: string[];
  hasPassword: boolean;
};

export type NotificationTypeEnumType =
  | "TASK_ASSIGNED"
  | "TASK_UPDATED"
  | "COMMENT_ADDED"
  | "MENTION_RECEIVED"
  | "PROJECT_CREATED"
  | "INVITE_ACCEPTED"
  | "FILE_UPLOADED";

export type NotificationCategoryType =
  | "TASK"
  | "PROJECT"
  | "COMMENT"
  | "INVITE"
  | "SYSTEM";

export type NotificationItemType = {
  _id: string;
  workspace: string;
  recipient: string;
  actor: string | null;
  type: NotificationTypeEnumType;
  category: NotificationCategoryType;
  entityType: string;
  entityId: string;
  title: string;
  body: string;
  readAt?: string | null;
  metadata?: {
    path?: string;
    projectId?: string;
    taskId?: string | null;
    commentId?: string;
    fileId?: string;
    targetType?: string;
    targetId?: string;
    joinedUserId?: string;
  };
  deletedAt?: string | null;
  deletedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationListPayloadType = {
  workspaceId: string;
  pageNumber?: number;
  pageSize?: number;
  category?: NotificationCategoryType;
  unreadOnly?: boolean;
};

export type NotificationListResponseType = {
  message: string;
  notifications: NotificationItemType[];
  pagination: PaginationType;
};

export type NotificationUnreadCountResponseType = {
  message: string;
  unreadCount: number;
};

export type NotificationReadPayloadType = {
  workspaceId: string;
  notificationId: string;
};

export type NotificationResponseType = {
  message: string;
  notification: NotificationItemType;
};

export type NotificationPreferenceMapType = Record<
  NotificationTypeEnumType,
  boolean
>;

export type NotificationPreferencesPayloadType = {
  workspaceId: string;
  preferences: Partial<NotificationPreferenceMapType>;
};

export type NotificationPreferencesResponseType = {
  message: string;
  preferences: NotificationPreferenceMapType;
};

export type MilestoneStatusType = "PLANNED" | "IN_PROGRESS" | "COMPLETED";

export type MilestoneType = {
  _id: string;
  workspace: string;
  project: string;
  name: string;
  description?: string | null;
  status: MilestoneStatusType;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  createdBy?: string;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type MilestonePayloadType = {
  workspaceId: string;
  milestoneId?: string;
  data: {
    project: string;
    name: string;
    description?: string | null;
    status: MilestoneStatusType;
    startDate?: string | null;
    dueDate?: string | null;
    completedAt?: string | null;
  };
};

export type MilestoneListResponseType = {
  message: string;
  milestones: MilestoneType[];
};

export type MilestoneResponseType = {
  message: string;
  milestone: MilestoneType;
};

export type TimelineRangeType = "30d" | "90d" | "180d" | "365d";

export type TimelineQueryPayloadType = {
  workspaceId: string;
  range?: TimelineRangeType;
  startDate?: string;
  endDate?: string;
  projectIds?: string[];
  assigneeIds?: string[];
  labelIds?: string[];
  statuses?: TaskStatusEnumType[];
};

export type TimelineProjectType = {
  _id: string;
  name: string;
  emoji?: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type TimelineTaskType = {
  _id: string;
  taskCode: string;
  title: string;
  project: string;
  status: TaskStatusEnumType;
  priority: TaskPriorityEnumType;
  assignedTo: {
    _id: string;
    name: string;
    profilePicture: string | null;
  } | null;
  labels: Pick<LabelType, "_id" | "name" | "color">[];
  createdAt: string;
  dueDate: string;
  barStart: string;
  barEnd: string;
  updatedAt?: string;
};

export type TimelineDependencyType = {
  _id: string;
  predecessorTask: string;
  successorTask: string;
  type: "FINISH_TO_START";
};

export type TimelineResponseType = {
  message: string;
  timeline: {
    range: {
      startDate: string;
      endDate: string;
    };
    projects: TimelineProjectType[];
    tasks: TimelineTaskType[];
    milestones: MilestoneType[];
    dependencies: TimelineDependencyType[];
  };
};

export type GanttQueryPayloadType = TimelineQueryPayloadType;

export type GanttDependencyWarningType = {
  dependencyId: string;
  predecessorTask: string | null;
  predecessorTitle: string;
  predecessorEndDate: string;
  successorStartDate: string;
  message: string;
};

export type GanttTaskType = Omit<TimelineTaskType, "createdAt" | "dueDate"> & {
  startDate: string;
  endDate: string;
  dueDate: string;
  createdAt: string;
  isBlocked: boolean;
  blockedByCount: number;
  dependencyWarnings: GanttDependencyWarningType[];
};

export type GanttResponseType = {
  message: string;
  gantt: {
    range: {
      startDate: string;
      endDate: string;
    };
    projects: TimelineProjectType[];
    tasks: GanttTaskType[];
    milestones: MilestoneType[];
    dependencies: TimelineDependencyType[];
  };
};

export type AuditLogType = {
  _id: string;
  actor:
    | string
    | {
        _id: string;
        name: string;
        email: string;
      }
    | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  requestId: string;
  createdAt: string;
};

export type AuditLogResponseType = {
  message: string;
  auditLogs: AuditLogType[];
  pagination: PaginationType;
};

export type WorkspacePolicyType = {
  _id: string;
  workspace: string;
  comments: {
    allowEdit: boolean;
    allowDelete: boolean;
  };
  files: {
    maxUploadBytes: number;
    allowedMimeTypes: string[];
  };
  members: {
    allowSelfInvite: boolean;
    allowGuestInvite: boolean;
  };
  retention: {
    notificationsDays: 90 | 180 | 365 | null;
    activityDays: 90 | 180 | 365 | null;
    auditDays: 90 | 180 | 365 | null;
    commentsDays: 90 | 180 | 365 | null;
    filesDays: 90 | 180 | 365 | null;
  };
};

export type WorkspacePolicyResponseType = {
  message: string;
  policy: WorkspacePolicyType;
};

export type RoleListResponseType = {
  message: string;
  roles: RoleType[];
};

export type RoleResponseType = {
  message: string;
  role: RoleType;
};

export type RolePayloadType = {
  workspaceId: string;
  roleId?: string;
  data: {
    name: string;
    description?: string | null;
    permissions: PermissionType[];
  };
};

export type ExportDatasetType =
  | "TASKS"
  | "PROJECTS"
  | "MEMBERS"
  | "COMMENTS"
  | "FILES"
  | "TIME_ENTRIES"
  | "AUDIT_LOGS";

export type ExportFormatType = "CSV" | "JSON" | "XLSX";

export type ExportJobType = {
  _id: string;
  datasets: ExportDatasetType[];
  format: ExportFormatType;
  status: "COMPLETED" | "FAILED";
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number;
  errorMessage?: string | null;
  expiresAt: string;
  createdAt: string;
  downloadPath: string | null;
};

export type ExportListResponseType = {
  message: string;
  exportJobs: ExportJobType[];
  pagination: PaginationType;
};

export type CreateExportPayloadType = {
  workspaceId: string;
  data: {
    datasets: ExportDatasetType[];
    format: ExportFormatType;
  };
};

export type SessionRecordType = {
  sessionId: string;
  userId: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  ipAddress: string;
  userAgent: string;
};

export type LoginEventType = {
  _id: string;
  userId: string;
  provider: string;
  success: boolean;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
};

export type SecuritySessionsResponseType = {
  message: string;
  sessions: SessionRecordType[];
  pagination: PaginationType;
};

export type SecurityLoginsResponseType = {
  message: string;
  logins: LoginEventType[];
  pagination: PaginationType;
};
