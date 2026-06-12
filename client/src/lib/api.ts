import API from "./axios-client";
import {
  AllMembersInWorkspaceResponseType,
  AllProjectPayloadType,
  AllProjectResponseType,
  AllTaskPayloadType,
  AllTaskResponseType,
  AnalyticsResponseType,
  ActivityFeedPayloadType,
  ActivityFeedResponseType,
  AccountSummaryResponseType,
  AddChecklistItemPayloadType,
  AddTaskDependencyPayloadType,
  AddTaskWatcherPayloadType,
  AuditLogResponseType,
  AvatarUploadPayloadType,
  AvatarUploadResponseType,
  ChangeWorkspaceMemberRoleType,
  ChecklistResponseType,
  CommentListPayloadType,
  CommentListResponseType,
  CommentRepliesPayloadType,
  CommentRepliesResponseType,
  CommentResponseType,
  CreateCommentPayloadType,
  CreateExportPayloadType,
  CreateLabelPayloadType,
  CreateProjectPayloadType,
  CreateReplyPayloadType,
  CreateSubtaskPayloadType,
  CreateTaskPayloadType,
  EditTaskPayloadType,
  DeleteCommentPayloadType,
  DeleteChecklistItemPayloadType,
  DeleteLabelPayloadType,
  EditCommentPayloadType,
  CreateWorkspaceResponseType,
  DashboardRangeType,
  EditProjectPayloadType,
  ExecutiveDashboardResponseType,
  ExportListResponseType,
  FileDeletePayloadType,
  FileListPayloadType,
  FileListResponseType,
  FileResponseType,
  FileUploadPayloadType,
  GanttQueryPayloadType,
  GanttResponseType,
  KanbanPayloadType,
  KanbanResponseType,
  LabelListPayloadType,
  LabelListResponseType,
  MilestoneListResponseType,
  MilestonePayloadType,
  MilestoneResponseType,
  NotificationListPayloadType,
  NotificationListResponseType,
  NotificationPreferencesPayloadType,
  NotificationPreferencesResponseType,
  NotificationReadPayloadType,
  NotificationResponseType,
  NotificationUnreadCountResponseType,
  PersonalDashboardResponseType,
  ProjectByIdPayloadType,
  ProjectResponseType,
  ReplyResponseType,
  RemoveTaskDependencyPayloadType,
  RemoveTaskWatcherPayloadType,
  ReplaceTaskLabelsPayloadType,
  RoleListResponseType,
  RolePayloadType,
  RoleResponseType,
  SearchPreviewPayloadType,
  SearchPreviewResponseType,
  SecurityLoginsResponseType,
  SecuritySessionsResponseType,
  SearchTypePayloadType,
  SearchTypeResponseType,
  SubtaskListPayloadType,
  SubtaskListResponseType,
  TeamDashboardResponseType,
  TimeEntryListPayloadType,
  TimeEntryListResponseType,
  TimeEntryMutationPayloadType,
  TimeEntryType,
  TimesheetResponseType,
  TaskDependencyListPayloadType,
  TaskDependencyListResponseType,
  TaskRecurrencePayloadType,
  TaskResponseType,
  TaskWatcherListResponseType,
  TimelineQueryPayloadType,
  TimelineResponseType,
  UpdateChecklistItemPayloadType,
  UpdateEmailPayloadType,
  UpdateLabelPayloadType,
  UpdatePasswordPayloadType,
  UpdateProfilePayloadType,
  UpdateCapacityPayloadType,
  UpdateTimeEntryPayloadType,
  ActiveTimerResponseType,
  ProductivityCapacityResponseType,
  ProductivityRangeType,
  ProductivityWorkloadResponseType,
  StartTimerPayloadType,
  StartTimerResponseType,
  UpdateTaskSchedulePayloadType,
  WorkspacePolicyResponseType,
  WorkspacePolicyType,
} from "../types/api.type";
import {
  AllWorkspaceResponseType,
  CreateWorkspaceType,
  CurrentUserResponseType,
  LoginResponseType,
  loginType,
  registerType,
  WorkspaceByIdResponseType,
  EditWorkspaceType,
} from "@/types/api.type";

export const loginMutationFn = async (
  data: loginType
): Promise<LoginResponseType> => {
  const response = await API.post("/auth/login", data);
  
  return response.data;
};

export const registerMutationFn = async (data: registerType) =>
  await API.post("/auth/register", data);

export const logoutMutationFn = async () => await API.post("/auth/logout");

export const getAuthConfigQueryFn = async (): Promise<{
  googleOAuthEnabled: boolean;
}> => {
  const response = await API.get("/auth/config");
  return response.data;
};

export const getCurrentUserQueryFn =
  async (): Promise<CurrentUserResponseType> => {
    const response = await API.get(`/user/current`);
    return response.data;
  };

export const getAccountSummaryQueryFn =
  async (): Promise<AccountSummaryResponseType> => {
    const response = await API.get(`/user/account`);
    return response.data;
  };

export const updateProfileMutationFn = async (
  data: UpdateProfilePayloadType
): Promise<CurrentUserResponseType> => {
  const response = await API.put(`/user/profile`, data);
  return response.data;
};

export const updateEmailMutationFn = async (
  data: UpdateEmailPayloadType
): Promise<CurrentUserResponseType> => {
  const response = await API.put(`/user/email`, data);
  return response.data;
};

export const updatePasswordMutationFn = async (
  data: UpdatePasswordPayloadType
): Promise<{ message: string }> => {
  const response = await API.put(`/user/password`, data);
  return response.data;
};

//********* WORKSPACE ****************
//************* */

export const createWorkspaceMutationFn = async (
  data: CreateWorkspaceType
): Promise<CreateWorkspaceResponseType> => {
  const response = await API.post(`/workspace/create/new`, data);
  return response.data;
};

export const editWorkspaceMutationFn = async ({
  workspaceId,
  data,
}: EditWorkspaceType) => {
  const response = await API.put(`/workspace/update/${workspaceId}`, data);
  return response.data;
};

export const getAllWorkspacesUserIsMemberQueryFn =
  async (): Promise<AllWorkspaceResponseType> => {
    const response = await API.get(`/workspace/all`);
    return response.data;
  };

export const getWorkspaceByIdQueryFn = async (
  workspaceId: string
): Promise<WorkspaceByIdResponseType> => {
  const response = await API.get(`/workspace/${workspaceId}`);
  return response.data;
};

export const getMembersInWorkspaceQueryFn = async (
  workspaceId: string
): Promise<AllMembersInWorkspaceResponseType> => {
  const response = await API.get(`/workspace/members/${workspaceId}`);
  return response.data;
};

export const getWorkspaceAnalyticsQueryFn = async (
  workspaceId: string
): Promise<AnalyticsResponseType> => {
  const response = await API.get(`/workspace/analytics/${workspaceId}`);
  return response.data;
};

const dashboardRangeQuery = (range: DashboardRangeType) =>
  new URLSearchParams({ range }).toString();

export const getPersonalDashboardQueryFn = async ({
  workspaceId,
  range,
}: {
  workspaceId: string;
  range: DashboardRangeType;
}): Promise<PersonalDashboardResponseType> => {
  const response = await API.get(
    `/dashboard/workspace/${workspaceId}/personal?${dashboardRangeQuery(range)}`
  );
  return response.data;
};

export const getTeamDashboardQueryFn = async ({
  workspaceId,
  range,
}: {
  workspaceId: string;
  range: DashboardRangeType;
}): Promise<TeamDashboardResponseType> => {
  const response = await API.get(
    `/dashboard/workspace/${workspaceId}/team?${dashboardRangeQuery(range)}`
  );
  return response.data;
};

export const getExecutiveDashboardQueryFn = async ({
  workspaceId,
  range,
}: {
  workspaceId: string;
  range: DashboardRangeType;
}): Promise<ExecutiveDashboardResponseType> => {
  const response = await API.get(
    `/dashboard/workspace/${workspaceId}/executive?${dashboardRangeQuery(range)}`
  );
  return response.data;
};

export const changeWorkspaceMemberRoleMutationFn = async ({
  workspaceId,
  data,
}: ChangeWorkspaceMemberRoleType) => {
  const response = await API.put(
    `/workspace/change/member/role/${workspaceId}`,
    data
  );
  return response.data;
};

export const getAuditLogsQueryFn = async ({
  workspaceId,
  pageNumber = 1,
  pageSize = 10,
}: {
  workspaceId: string;
  pageNumber?: number;
  pageSize?: number;
}): Promise<AuditLogResponseType> => {
  const response = await API.get(
    `/audit/workspace/${workspaceId}?pageNumber=${pageNumber}&pageSize=${pageSize}`
  );
  return response.data;
};

export const getRolesQueryFn = async (
  workspaceId: string
): Promise<RoleListResponseType> => {
  const response = await API.get(`/role/workspace/${workspaceId}`);
  return response.data;
};

export const createRoleMutationFn = async ({
  workspaceId,
  data,
}: RolePayloadType): Promise<RoleResponseType> => {
  const response = await API.post(`/role/workspace/${workspaceId}`, data);
  return response.data;
};

export const updateRoleMutationFn = async ({
  workspaceId,
  roleId,
  data,
}: RolePayloadType): Promise<RoleResponseType> => {
  const response = await API.put(`/role/workspace/${workspaceId}/${roleId}`, data);
  return response.data;
};

export const deleteRoleMutationFn = async ({
  workspaceId,
  roleId,
}: {
  workspaceId: string;
  roleId: string;
}): Promise<{ message: string }> => {
  const response = await API.delete(`/role/workspace/${workspaceId}/${roleId}`);
  return response.data;
};

export const assignMemberRoleMutationFn = async ({
  workspaceId,
  memberId,
  roleId,
}: {
  workspaceId: string;
  memberId: string;
  roleId: string;
}): Promise<{ message: string }> => {
  const response = await API.put(
    `/member/workspace/${workspaceId}/${memberId}/role`,
    { roleId }
  );
  return response.data;
};

export const deactivateMemberMutationFn = async ({
  workspaceId,
  memberId,
}: {
  workspaceId: string;
  memberId: string;
}): Promise<{ message: string }> => {
  const response = await API.patch(
    `/member/workspace/${workspaceId}/${memberId}/deactivate`
  );
  return response.data;
};

export const removeMemberMutationFn = async ({
  workspaceId,
  memberId,
}: {
  workspaceId: string;
  memberId: string;
}): Promise<{ message: string }> => {
  const response = await API.delete(`/member/workspace/${workspaceId}/${memberId}`);
  return response.data;
};

export const getWorkspacePolicyQueryFn = async (
  workspaceId: string
): Promise<WorkspacePolicyResponseType> => {
  const response = await API.get(`/policy/workspace/${workspaceId}`);
  return response.data;
};

export const updateWorkspacePolicyMutationFn = async ({
  workspaceId,
  data,
}: {
  workspaceId: string;
  data: Partial<WorkspacePolicyType>;
}): Promise<WorkspacePolicyResponseType> => {
  const response = await API.put(`/policy/workspace/${workspaceId}`, data);
  return response.data;
};

export const createExportMutationFn = async ({
  workspaceId,
  data,
}: CreateExportPayloadType): Promise<ExportListResponseType> => {
  const response = await API.post(`/export/workspace/${workspaceId}`, data);
  return response.data;
};

export const getExportsQueryFn = async (
  workspaceId: string
): Promise<ExportListResponseType> => {
  const response = await API.get(`/export/workspace/${workspaceId}`);
  return response.data;
};

export const deleteExportMutationFn = async ({
  workspaceId,
  exportId,
}: {
  workspaceId: string;
  exportId: string;
}): Promise<{ message: string }> => {
  const response = await API.delete(`/export/workspace/${workspaceId}/${exportId}`);
  return response.data;
};

export const getSecuritySessionsQueryFn = async (
  workspaceId: string
): Promise<SecuritySessionsResponseType> => {
  const response = await API.get(`/security/workspace/${workspaceId}/sessions`);
  return response.data;
};

export const getSecurityLoginsQueryFn = async (
  workspaceId: string
): Promise<SecurityLoginsResponseType> => {
  const response = await API.get(`/security/workspace/${workspaceId}/logins`);
  return response.data;
};

export const revokeSecuritySessionMutationFn = async ({
  workspaceId,
  sessionId,
}: {
  workspaceId: string;
  sessionId: string;
}): Promise<{ message: string }> => {
  const response = await API.delete(
    `/security/workspace/${workspaceId}/session/${sessionId}`
  );
  return response.data;
};

export const deleteWorkspaceMutationFn = async (
  workspaceId: string
): Promise<{
  message: string;
  currentWorkspace: string;
}> => {
  const response = await API.delete(`/workspace/delete/${workspaceId}`);
  return response.data;
};

//*******MEMBER ****************

export const invitedUserJoinWorkspaceMutationFn = async (
  iniviteCode: string
): Promise<{
  message: string;
  workspaceId: string;
}> => {
  const response = await API.post(`/member/workspace/${iniviteCode}/join`);
  return response.data;
};

export const searchWorkspacePreviewQueryFn = async ({
  workspaceId,
  q,
  types,
  limitPerType,
}: SearchPreviewPayloadType): Promise<SearchPreviewResponseType> => {
  const queryParams = new URLSearchParams({ q });
  if (types?.length) queryParams.set("types", types.join(","));
  if (limitPerType) queryParams.set("limitPerType", limitPerType.toString());

  const response = await API.get(
    `/search/workspace/${workspaceId}?${queryParams.toString()}`
  );
  return response.data;
};

export const searchWorkspaceTypeQueryFn = async ({
  workspaceId,
  type,
  q,
  pageNumber = 1,
  pageSize = 20,
}: SearchTypePayloadType): Promise<SearchTypeResponseType> => {
  const queryParams = new URLSearchParams({
    q,
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
  });

  const response = await API.get(
    `/search/workspace/${workspaceId}/type/${type}?${queryParams.toString()}`
  );
  return response.data;
};

//********* */
//********* PROJECTS
export const createProjectMutationFn = async ({
  workspaceId,
  data,
}: CreateProjectPayloadType): Promise<ProjectResponseType> => {
  const response = await API.post(
    `/project/workspace/${workspaceId}/create`,
    data
  );
  return response.data;
};

export const editProjectMutationFn = async ({
  projectId,
  workspaceId,
  data,
}: EditProjectPayloadType): Promise<ProjectResponseType> => {
  const response = await API.put(
    `/project/${projectId}/workspace/${workspaceId}/update`,
    data
  );
  return response.data;
};

export const getProjectsInWorkspaceQueryFn = async ({
  workspaceId,
  pageSize = 10,
  pageNumber = 1,
}: AllProjectPayloadType): Promise<AllProjectResponseType> => {
  const response = await API.get(
    `/project/workspace/${workspaceId}/all?pageSize=${pageSize}&pageNumber=${pageNumber}`
  );
  return response.data;
};

export const getProjectByIdQueryFn = async ({
  workspaceId,
  projectId,
}: ProjectByIdPayloadType): Promise<ProjectResponseType> => {
  const response = await API.get(
    `/project/${projectId}/workspace/${workspaceId}`
  );
  return response.data;
};

export const getProjectAnalyticsQueryFn = async ({
  workspaceId,
  projectId,
}: ProjectByIdPayloadType): Promise<AnalyticsResponseType> => {
  const response = await API.get(
    `/project/${projectId}/workspace/${workspaceId}/analytics`
  );
  return response.data;
};

export const deleteProjectMutationFn = async ({
  workspaceId,
  projectId,
}: ProjectByIdPayloadType): Promise<{
  message: string;
}> => {
  const response = await API.delete(
    `/project/${projectId}/workspace/${workspaceId}/delete`
  );
  return response.data;
};

//*******TASKS ********************************
//************************* */

export const createTaskMutationFn = async ({
  workspaceId,
  projectId,
  data,
}: CreateTaskPayloadType) => {
  const response = await API.post(
    `/task/project/${projectId}/workspace/${workspaceId}/create`,
    data
  );
  return response.data;
};


export const editTaskMutationFn = async ({
  taskId,
  projectId,
  workspaceId,
  data,
}: EditTaskPayloadType): Promise<{message: string;}> => {
  const response = await API.put(
    `/task/${taskId}/project/${projectId}/workspace/${workspaceId}/update/`,
    data
  );
  return response.data;
};

export const getAllTasksQueryFn = async ({
  workspaceId,
  keyword,
  projectId,
  assignedTo,
  priority,
  status,
  dueDate,
  dueDateFrom,
  dueDateTo,
  pageNumber,
  pageSize,
}: AllTaskPayloadType): Promise<AllTaskResponseType> => {
  const baseUrl = `/task/workspace/${workspaceId}/all`;

  const queryParams = new URLSearchParams();
  if (keyword) queryParams.append("keyword", keyword);
  if (projectId) queryParams.append("projectId", projectId);
  if (assignedTo) queryParams.append("assignedTo", assignedTo);
  if (priority) queryParams.append("priority", priority);
  if (status) queryParams.append("status", status);
  if (dueDate) queryParams.append("dueDate", dueDate);
  if (dueDateFrom) queryParams.append("dueDateFrom", dueDateFrom);
  if (dueDateTo) queryParams.append("dueDateTo", dueDateTo);
  if (pageNumber) queryParams.append("pageNumber", pageNumber?.toString());
  if (pageSize) queryParams.append("pageSize", pageSize?.toString());

  const url = queryParams.toString() ? `${baseUrl}?${queryParams}` : baseUrl;
  const response = await API.get(url);
  return response.data;
};

export const getKanbanTasksQueryFn = async ({
  workspaceId,
  keyword,
  projectId,
  assignedTo,
  priority,
  labelIds,
  status,
  cursor,
  columnLimit,
}: KanbanPayloadType): Promise<KanbanResponseType> => {
  const baseUrl = `/task/workspace/${workspaceId}/kanban`;

  const queryParams = new URLSearchParams();
  if (keyword) queryParams.append("keyword", keyword);
  if (projectId) queryParams.append("projectId", projectId);
  if (assignedTo) queryParams.append("assignedTo", assignedTo);
  if (priority) queryParams.append("priority", priority);
  if (labelIds) queryParams.append("labelIds", labelIds);
  if (status) queryParams.append("status", status);
  if (cursor) queryParams.append("cursor", cursor);
  if (columnLimit) queryParams.append("columnLimit", columnLimit.toString());

  const url = queryParams.toString() ? `${baseUrl}?${queryParams}` : baseUrl;
  const response = await API.get(url);
  return response.data;
};

export const getTaskByIdQueryFn = async ({
  workspaceId,
  projectId,
  taskId,
}: {
  workspaceId: string;
  projectId: string;
  taskId: string;
}): Promise<TaskResponseType> => {
  const response = await API.get(
    `/task/${taskId}/project/${projectId}/workspace/${workspaceId}`
  );
  return response.data;
};

export const deleteTaskMutationFn = async ({
  workspaceId,
  taskId,
}: {
  workspaceId: string;
  taskId: string;
}): Promise<{
  message: string;
}> => {
  const response = await API.delete(
    `task/${taskId}/workspace/${workspaceId}/delete`
  );
  return response.data;
};

//*******ADVANCED TASKS ********************************

export const getLabelsQueryFn = async ({
  workspaceId,
  pageNumber = 1,
  pageSize = 100,
}: LabelListPayloadType): Promise<LabelListResponseType> => {
  const response = await API.get(
    `/label/workspace/${workspaceId}?pageNumber=${pageNumber}&pageSize=${pageSize}`
  );
  return response.data;
};

export const createLabelMutationFn = async ({
  workspaceId,
  data,
}: CreateLabelPayloadType) => {
  const response = await API.post(`/label/workspace/${workspaceId}`, data);
  return response.data;
};

export const updateLabelMutationFn = async ({
  workspaceId,
  labelId,
  data,
}: UpdateLabelPayloadType) => {
  const response = await API.put(
    `/label/workspace/${workspaceId}/${labelId}`,
    data
  );
  return response.data;
};

export const deleteLabelMutationFn = async ({
  workspaceId,
  labelId,
}: DeleteLabelPayloadType) => {
  const response = await API.delete(`/label/workspace/${workspaceId}/${labelId}`);
  return response.data;
};

export const createSubtaskMutationFn = async ({
  workspaceId,
  parentTaskId,
  data,
}: CreateSubtaskPayloadType) => {
  const response = await API.post(
    `/task/${parentTaskId}/workspace/${workspaceId}/subtasks`,
    data
  );
  return response.data;
};

export const getSubtasksQueryFn = async ({
  workspaceId,
  parentTaskId,
}: SubtaskListPayloadType): Promise<SubtaskListResponseType> => {
  const response = await API.get(
    `/task/${parentTaskId}/workspace/${workspaceId}/subtasks`
  );
  return response.data;
};

export const addChecklistItemMutationFn = async ({
  workspaceId,
  taskId,
  text,
}: AddChecklistItemPayloadType): Promise<ChecklistResponseType> => {
  const response = await API.post(
    `/task/${taskId}/workspace/${workspaceId}/checklist`,
    { text }
  );
  return response.data;
};

export const updateChecklistItemMutationFn = async ({
  workspaceId,
  taskId,
  itemId,
  data,
}: UpdateChecklistItemPayloadType): Promise<ChecklistResponseType> => {
  const response = await API.put(
    `/task/${taskId}/workspace/${workspaceId}/checklist/${itemId}`,
    data
  );
  return response.data;
};

export const deleteChecklistItemMutationFn = async ({
  workspaceId,
  taskId,
  itemId,
}: DeleteChecklistItemPayloadType): Promise<ChecklistResponseType> => {
  const response = await API.delete(
    `/task/${taskId}/workspace/${workspaceId}/checklist/${itemId}`
  );
  return response.data;
};

export const replaceTaskLabelsMutationFn = async ({
  workspaceId,
  taskId,
  labelIds,
}: ReplaceTaskLabelsPayloadType) => {
  const response = await API.put(
    `/task/${taskId}/workspace/${workspaceId}/labels`,
    { labelIds }
  );
  return response.data;
};

export const getTaskDependenciesQueryFn = async ({
  workspaceId,
  taskId,
}: TaskDependencyListPayloadType): Promise<TaskDependencyListResponseType> => {
  const response = await API.get(
    `/task/${taskId}/workspace/${workspaceId}/dependencies`
  );
  return response.data;
};

export const addTaskDependencyMutationFn = async ({
  workspaceId,
  taskId,
  predecessorTaskId,
}: AddTaskDependencyPayloadType) => {
  const response = await API.post(
    `/task/${taskId}/workspace/${workspaceId}/dependencies`,
    { predecessorTaskId }
  );
  return response.data;
};

export const removeTaskDependencyMutationFn = async ({
  workspaceId,
  dependencyId,
}: RemoveTaskDependencyPayloadType) => {
  const response = await API.delete(
    `/task/workspace/${workspaceId}/dependencies/${dependencyId}`
  );
  return response.data;
};

export const getTaskWatchersQueryFn = async ({
  workspaceId,
  taskId,
}: {
  workspaceId: string;
  taskId: string;
}): Promise<TaskWatcherListResponseType> => {
  const response = await API.get(
    `/task/${taskId}/workspace/${workspaceId}/watchers`
  );
  return response.data;
};

export const addTaskWatcherMutationFn = async ({
  workspaceId,
  taskId,
  userId,
}: AddTaskWatcherPayloadType) => {
  const response = await API.post(
    `/task/${taskId}/workspace/${workspaceId}/watchers`,
    { userId }
  );
  return response.data;
};

export const removeTaskWatcherMutationFn = async ({
  workspaceId,
  taskId,
  userId,
}: RemoveTaskWatcherPayloadType) => {
  const response = await API.delete(
    `/task/${taskId}/workspace/${workspaceId}/watchers/${userId}`
  );
  return response.data;
};

export const watchTaskMutationFn = async ({
  workspaceId,
  taskId,
}: {
  workspaceId: string;
  taskId: string;
}) => {
  const response = await API.post(`/task/${taskId}/workspace/${workspaceId}/watch`);
  return response.data;
};

export const unwatchTaskMutationFn = async ({
  workspaceId,
  taskId,
}: {
  workspaceId: string;
  taskId: string;
}) => {
  const response = await API.delete(
    `/task/${taskId}/workspace/${workspaceId}/watch`
  );
  return response.data;
};

export const updateTaskRecurrenceMutationFn = async ({
  workspaceId,
  taskId,
  data,
}: TaskRecurrencePayloadType) => {
  const response = await API.put(
    `/task/${taskId}/workspace/${workspaceId}/recurrence`,
    data
  );
  return response.data;
};

export const clearTaskRecurrenceMutationFn = async ({
  workspaceId,
  taskId,
}: {
  workspaceId: string;
  taskId: string;
}) => {
  const response = await API.delete(
    `/task/${taskId}/workspace/${workspaceId}/recurrence`
  );
  return response.data;
};

//*******COMMENTS AND ACTIVITY ********************************

export const getCommentsQueryFn = async ({
  workspaceId,
  targetType,
  targetId,
  pageNumber = 1,
  pageSize = 20,
}: CommentListPayloadType): Promise<CommentListResponseType> => {
  const response = await API.get(
    `/comment/workspace/${workspaceId}/target/${targetType}/${targetId}?pageNumber=${pageNumber}&pageSize=${pageSize}`
  );
  return response.data;
};

export const createCommentMutationFn = async ({
  workspaceId,
  targetType,
  targetId,
  bodyJson,
  plainText,
}: CreateCommentPayloadType): Promise<CommentResponseType> => {
  const response = await API.post(
    `/comment/workspace/${workspaceId}/target/${targetType}/${targetId}`,
    { bodyJson, plainText }
  );
  return response.data;
};

export const getCommentRepliesQueryFn = async ({
  workspaceId,
  commentId,
  pageNumber = 1,
  pageSize = 20,
}: CommentRepliesPayloadType): Promise<CommentRepliesResponseType> => {
  const response = await API.get(
    `/comment/workspace/${workspaceId}/${commentId}/replies?pageNumber=${pageNumber}&pageSize=${pageSize}`
  );
  return response.data;
};

export const createCommentReplyMutationFn = async ({
  workspaceId,
  commentId,
  bodyJson,
  plainText,
}: CreateReplyPayloadType): Promise<ReplyResponseType> => {
  const response = await API.post(
    `/comment/workspace/${workspaceId}/${commentId}/reply`,
    { bodyJson, plainText }
  );
  return response.data;
};

export const editCommentMutationFn = async ({
  workspaceId,
  commentId,
  bodyJson,
  plainText,
}: EditCommentPayloadType): Promise<CommentResponseType> => {
  const response = await API.put(
    `/comment/workspace/${workspaceId}/${commentId}`,
    { bodyJson, plainText }
  );
  return response.data;
};

export const deleteCommentMutationFn = async ({
  workspaceId,
  commentId,
}: DeleteCommentPayloadType): Promise<{ message: string }> => {
  const response = await API.delete(
    `/comment/workspace/${workspaceId}/${commentId}`
  );
  return response.data;
};

export const getActivityFeedQueryFn = async ({
  workspaceId,
  targetType,
  targetId,
  pageNumber = 1,
  pageSize = 20,
}: ActivityFeedPayloadType): Promise<ActivityFeedResponseType> => {
  const queryParams = new URLSearchParams();
  queryParams.append("pageNumber", pageNumber.toString());
  queryParams.append("pageSize", pageSize.toString());
  if (targetType && targetId) {
    queryParams.append("targetType", targetType);
    queryParams.append("targetId", targetId);
  }

  const response = await API.get(
    `/activity/workspace/${workspaceId}?${queryParams.toString()}`
  );
  return response.data;
};

//*******FILES ********************************

export const getFileAssetsQueryFn = async ({
  workspaceId,
  targetType,
  targetId,
  pageNumber = 1,
  pageSize = 20,
}: FileListPayloadType): Promise<FileListResponseType> => {
  const response = await API.get(
    `/file/workspace/${workspaceId}/target/${targetType}/${targetId}?pageNumber=${pageNumber}&pageSize=${pageSize}`
  );
  return response.data;
};

export const uploadFileAssetMutationFn = async ({
  workspaceId,
  targetType,
  targetId,
  file,
}: FileUploadPayloadType): Promise<FileResponseType> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await API.post(
    `/file/workspace/${workspaceId}/target/${targetType}/${targetId}`,
    formData
  );
  return response.data;
};

export const deleteFileAssetMutationFn = async ({
  workspaceId,
  fileId,
}: FileDeletePayloadType): Promise<{ message: string }> => {
  const response = await API.delete(`/file/workspace/${workspaceId}/${fileId}`);
  return response.data;
};

export const uploadAvatarMutationFn = async ({
  workspaceId,
  file,
}: AvatarUploadPayloadType): Promise<AvatarUploadResponseType> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await API.post(
    `/file/workspace/${workspaceId}/avatar`,
    formData
  );
  return response.data;
};

//*******NOTIFICATIONS ********************************

export const getNotificationsQueryFn = async ({
  workspaceId,
  pageNumber = 1,
  pageSize = 20,
  category,
  unreadOnly,
}: NotificationListPayloadType): Promise<NotificationListResponseType> => {
  const queryParams = new URLSearchParams();
  queryParams.append("pageNumber", pageNumber.toString());
  queryParams.append("pageSize", pageSize.toString());
  if (category) queryParams.append("category", category);
  if (unreadOnly) queryParams.append("unreadOnly", "true");

  const response = await API.get(
    `/notification/workspace/${workspaceId}?${queryParams.toString()}`
  );
  return response.data;
};

export const getUnreadNotificationCountQueryFn = async (
  workspaceId: string
): Promise<NotificationUnreadCountResponseType> => {
  const response = await API.get(
    `/notification/workspace/${workspaceId}/unread-count`
  );
  return response.data;
};

export const markNotificationReadMutationFn = async ({
  workspaceId,
  notificationId,
}: NotificationReadPayloadType): Promise<NotificationResponseType> => {
  const response = await API.put(
    `/notification/workspace/${workspaceId}/${notificationId}/read`
  );
  return response.data;
};

export const markAllNotificationsReadMutationFn = async (
  workspaceId: string
): Promise<{ message: string; modifiedCount: number }> => {
  const response = await API.put(
    `/notification/workspace/${workspaceId}/read-all`
  );
  return response.data;
};

export const deleteNotificationMutationFn = async ({
  workspaceId,
  notificationId,
}: NotificationReadPayloadType): Promise<{ message: string }> => {
  const response = await API.delete(
    `/notification/workspace/${workspaceId}/${notificationId}`
  );
  return response.data;
};

export const getNotificationPreferencesQueryFn = async (
  workspaceId: string
): Promise<NotificationPreferencesResponseType> => {
  const response = await API.get(
    `/notification/workspace/${workspaceId}/settings`
  );
  return response.data;
};

export const updateNotificationPreferencesMutationFn = async ({
  workspaceId,
  preferences,
}: NotificationPreferencesPayloadType): Promise<NotificationPreferencesResponseType> => {
  const response = await API.put(
    `/notification/workspace/${workspaceId}/settings`,
    { preferences }
  );
  return response.data;
};

//*******MILESTONES AND TIMELINE ********************************

export const getMilestonesQueryFn = async (
  workspaceId: string
): Promise<MilestoneListResponseType> => {
  const response = await API.get(`/milestone/workspace/${workspaceId}`);
  return response.data;
};

export const createMilestoneMutationFn = async ({
  workspaceId,
  data,
}: MilestonePayloadType): Promise<MilestoneResponseType> => {
  const response = await API.post(`/milestone/workspace/${workspaceId}`, data);
  return response.data;
};

export const updateMilestoneMutationFn = async ({
  workspaceId,
  milestoneId,
  data,
}: MilestonePayloadType): Promise<MilestoneResponseType> => {
  const response = await API.put(
    `/milestone/workspace/${workspaceId}/${milestoneId}`,
    data
  );
  return response.data;
};

export const deleteMilestoneMutationFn = async ({
  workspaceId,
  milestoneId,
}: {
  workspaceId: string;
  milestoneId: string;
}): Promise<{ message: string }> => {
  const response = await API.delete(
    `/milestone/workspace/${workspaceId}/${milestoneId}`
  );
  return response.data;
};

export const getTimelineQueryFn = async ({
  workspaceId,
  range = "90d",
  startDate,
  endDate,
  projectIds,
  assigneeIds,
  labelIds,
  statuses,
}: TimelineQueryPayloadType): Promise<TimelineResponseType> => {
  const queryParams = new URLSearchParams({ range });
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  if (projectIds?.length) queryParams.set("projectIds", projectIds.join(","));
  if (assigneeIds?.length) queryParams.set("assigneeIds", assigneeIds.join(","));
  if (labelIds?.length) queryParams.set("labelIds", labelIds.join(","));
  if (statuses?.length) queryParams.set("statuses", statuses.join(","));

  const response = await API.get(
    `/timeline/workspace/${workspaceId}?${queryParams.toString()}`
  );
  return response.data;
};

export const getGanttQueryFn = async ({
  workspaceId,
  range = "90d",
  startDate,
  endDate,
  projectIds,
  assigneeIds,
  labelIds,
  statuses,
}: GanttQueryPayloadType): Promise<GanttResponseType> => {
  const queryParams = new URLSearchParams({ range });
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  if (projectIds?.length) queryParams.set("projectIds", projectIds.join(","));
  if (assigneeIds?.length) queryParams.set("assigneeIds", assigneeIds.join(","));
  if (labelIds?.length) queryParams.set("labelIds", labelIds.join(","));
  if (statuses?.length) queryParams.set("statuses", statuses.join(","));

  const response = await API.get(
    `/gantt/workspace/${workspaceId}?${queryParams.toString()}`
  );
  return response.data;
};

export const updateTaskScheduleMutationFn = async ({
  workspaceId,
  taskId,
  data,
}: UpdateTaskSchedulePayloadType): Promise<{ message: string }> => {
  const response = await API.put(
    `/task/${taskId}/workspace/${workspaceId}/schedule`,
    data
  );
  return response.data;
};

const appendOptionalTimeFilters = (
  queryParams: URLSearchParams,
  filters: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    projectId?: string;
    taskId?: string;
    pageNumber?: number;
    pageSize?: number;
  }
) => {
  if (filters.startDate) queryParams.set("startDate", filters.startDate);
  if (filters.endDate) queryParams.set("endDate", filters.endDate);
  if (filters.userId) queryParams.set("userId", filters.userId);
  if (filters.projectId) queryParams.set("projectId", filters.projectId);
  if (filters.taskId) queryParams.set("taskId", filters.taskId);
  if (filters.pageNumber) queryParams.set("pageNumber", String(filters.pageNumber));
  if (filters.pageSize) queryParams.set("pageSize", String(filters.pageSize));
};

export const getActiveTimerQueryFn = async (
  workspaceId: string
): Promise<ActiveTimerResponseType> => {
  const response = await API.get(`/time/workspace/${workspaceId}/active`);
  return response.data;
};

export const startTimerMutationFn = async ({
  workspaceId,
  data,
}: StartTimerPayloadType): Promise<StartTimerResponseType> => {
  const response = await API.post(
    `/time/workspace/${workspaceId}/timer/start`,
    data
  );
  return response.data;
};

export const stopTimerMutationFn = async (
  workspaceId: string
): Promise<{ message: string; timeEntry: TimeEntryType }> => {
  const response = await API.post(`/time/workspace/${workspaceId}/timer/stop`);
  return response.data;
};

export const createTimeEntryMutationFn = async ({
  workspaceId,
  data,
}: TimeEntryMutationPayloadType): Promise<{ message: string }> => {
  const response = await API.post(`/time/workspace/${workspaceId}/entries`, data);
  return response.data;
};

export const getTimeEntriesQueryFn = async ({
  workspaceId,
  ...filters
}: TimeEntryListPayloadType): Promise<TimeEntryListResponseType> => {
  const queryParams = new URLSearchParams();
  appendOptionalTimeFilters(queryParams, filters);
  const query = queryParams.toString();
  const response = await API.get(
    `/time/workspace/${workspaceId}/entries${query ? `?${query}` : ""}`
  );
  return response.data;
};

export const updateTimeEntryMutationFn = async ({
  workspaceId,
  entryId,
  data,
}: UpdateTimeEntryPayloadType): Promise<{ message: string }> => {
  const response = await API.patch(
    `/time/workspace/${workspaceId}/entries/${entryId}`,
    data
  );
  return response.data;
};

export const deleteTimeEntryMutationFn = async ({
  workspaceId,
  entryId,
}: {
  workspaceId: string;
  entryId: string;
}): Promise<{ message: string }> => {
  const response = await API.delete(
    `/time/workspace/${workspaceId}/entries/${entryId}`
  );
  return response.data;
};

export const getTimesheetQueryFn = async ({
  workspaceId,
  startDate,
  endDate,
  userId,
}: {
  workspaceId: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
}): Promise<TimesheetResponseType> => {
  const queryParams = new URLSearchParams();
  appendOptionalTimeFilters(queryParams, { startDate, endDate, userId });
  const query = queryParams.toString();
  const response = await API.get(
    `/time/workspace/${workspaceId}/timesheet${query ? `?${query}` : ""}`
  );
  return response.data;
};

export const getProductivityWorkloadQueryFn = async ({
  workspaceId,
  range,
}: {
  workspaceId: string;
  range: ProductivityRangeType;
}): Promise<ProductivityWorkloadResponseType> => {
  const response = await API.get(
    `/time/workspace/${workspaceId}/workload?range=${range}`
  );
  return response.data;
};

export const getProductivityCapacityQueryFn = async ({
  workspaceId,
  range,
}: {
  workspaceId: string;
  range: ProductivityRangeType;
}): Promise<ProductivityCapacityResponseType> => {
  const response = await API.get(
    `/time/workspace/${workspaceId}/capacity?range=${range}`
  );
  return response.data;
};

export const updateCapacityMutationFn = async ({
  workspaceId,
  memberId,
  data,
}: UpdateCapacityPayloadType): Promise<{ message: string }> => {
  const response = await API.patch(
    `/time/workspace/${workspaceId}/capacity/${memberId}`,
    data
  );
  return response.data;
};
