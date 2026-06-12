import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import {
  addChecklistItemSchema,
  addTaskDependencySchema,
  checklistItemIdSchema,
  createTaskSchema,
  createSubtaskSchema,
  dependencyIdSchema,
  getKanbanTasksQuerySchema,
  getTasksQuerySchema,
  replaceTaskLabelsSchema,
  taskIdSchema,
  taskWatcherSchema,
  updateChecklistItemSchema,
  updateTaskScheduleSchema,
  updateTaskRecurrenceSchema,
  updateTaskSchema,
} from "../validation/task.validation";
import { projectIdSchema } from "../validation/project.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";
import { Permissions } from "../enums/role.enum";
import { getMemberRoleInWorkspace } from "../services/member.service";
import { roleGuard } from "../utils/roleGuard";
import {
  addChecklistItemService,
  addTaskDependencyService,
  addTaskWatcherService,
  clearTaskRecurrenceService,
  createTaskService,
  createSubtaskService,
  deleteTaskService,
  deleteChecklistItemService,
  getAllTasksService,
  getKanbanTasksService,
  getTaskByIdService,
  listSubtasksService,
  listTaskDependenciesService,
  listTaskWatchersService,
  removeTaskDependencyService,
  removeTaskWatcherService,
  replaceTaskLabelsService,
  updateChecklistItemService,
  updateTaskScheduleService,
  updateTaskRecurrenceService,
  updateTaskService,
} from "../services/task.service";
import { HTTPSTATUS } from "../config/http.config";
import { buildRequestContext } from "../utils/request-context";

export const createTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const body = createTaskSchema.parse(req.body);
    const projectId = projectIdSchema.parse(req.params.projectId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.CREATE_TASK]);

    const { task } = await createTaskService(
      workspaceId,
      projectId,
      userId,
      body,
      buildRequestContext(req, workspaceId)
    );

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Task created successfully",
      task,
    });
  }
);

export const updateTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const body = updateTaskSchema.parse(req.body);

    const taskId = taskIdSchema.parse(req.params.id);
    const projectId = projectIdSchema.parse(req.params.projectId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_TASK]);

    const { updatedTask } = await updateTaskService(
      workspaceId,
      projectId,
      taskId,
      body,
      buildRequestContext(req, workspaceId)
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Task updated successfully",
      task: updatedTask,
    });
  }
);

export const updateTaskScheduleController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const taskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = updateTaskScheduleSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_TASK]);

    const { task } = await updateTaskScheduleService(
      buildRequestContext(req, workspaceId),
      taskId,
      body
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Task schedule updated successfully",
      task,
    });
  }
);

export const getAllTasksController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const query = getTasksQuerySchema.parse(req.query);

    const filters = {
      projectId: query.projectId,
      status: query.status,
      priority: query.priority,
      assignedTo: query.assignedTo,
      keyword: query.keyword,
      dueDate: query.dueDate,
      dueDateFrom: query.dueDateFrom,
      dueDateTo: query.dueDateTo,
    };

    const pagination = {
      pageSize: query.pageSize,
      pageNumber: query.pageNumber,
    };

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await getAllTasksService(workspaceId, filters, pagination);

    return res.status(HTTPSTATUS.OK).json({
      message: "All tasks fetched successfully",
      ...result,
    });
  }
);

export const getKanbanTasksController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const query = getKanbanTasksQuerySchema.parse(req.query);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await getKanbanTasksService(workspaceId, query);

    return res.status(HTTPSTATUS.OK).json({
      message: "Kanban tasks fetched successfully",
      ...result,
    });
  }
);

export const getTaskByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const taskId = taskIdSchema.parse(req.params.id);
    const projectId = projectIdSchema.parse(req.params.projectId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const task = await getTaskByIdService(workspaceId, projectId, taskId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Task fetched successfully",
      task,
    });
  }
);

export const deleteTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const taskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.DELETE_TASK]);

    await deleteTaskService(
      workspaceId,
      taskId,
      userId?.toString(),
      buildRequestContext(req, workspaceId)
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Task deleted successfully",
    });
  }
);

export const createSubtaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const parentTaskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = createSubtaskSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.CREATE_TASK]);

    const { subtask } = await createSubtaskService(
      workspaceId,
      parentTaskId,
      userId,
      body,
      buildRequestContext(req, workspaceId)
    );

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Subtask created successfully",
      subtask,
    });
  }
);

export const listSubtasksController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const parentTaskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await listSubtasksService(workspaceId, parentTaskId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Subtasks fetched successfully",
      ...result,
    });
  }
);

export const addChecklistItemController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const taskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = addChecklistItemSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_TASK]);

    const result = await addChecklistItemService(
      buildRequestContext(req, workspaceId),
      taskId,
      body.text
    );

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Checklist item created successfully",
      ...result,
    });
  }
);

export const updateChecklistItemController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const taskId = taskIdSchema.parse(req.params.id);
    const itemId = checklistItemIdSchema.parse(req.params.itemId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = updateChecklistItemSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_TASK]);

    const result = await updateChecklistItemService(
      buildRequestContext(req, workspaceId),
      taskId,
      itemId,
      body
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Checklist item updated successfully",
      ...result,
    });
  }
);

export const deleteChecklistItemController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const taskId = taskIdSchema.parse(req.params.id);
    const itemId = checklistItemIdSchema.parse(req.params.itemId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_TASK]);

    const result = await deleteChecklistItemService(
      buildRequestContext(req, workspaceId),
      taskId,
      itemId
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Checklist item deleted successfully",
      ...result,
    });
  }
);

export const replaceTaskLabelsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const taskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = replaceTaskLabelsSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_TASK]);

    const result = await replaceTaskLabelsService(
      buildRequestContext(req, workspaceId),
      taskId,
      body.labelIds
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Task labels updated successfully",
      ...result,
    });
  }
);

export const listTaskDependenciesController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const taskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await listTaskDependenciesService(workspaceId, taskId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Task dependencies fetched successfully",
      ...result,
    });
  }
);

export const addTaskDependencyController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const taskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = addTaskDependencySchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.MANAGE_TASK_RELATIONS]);

    const result = await addTaskDependencyService(
      buildRequestContext(req, workspaceId),
      taskId,
      body.predecessorTaskId
    );

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Task dependency created successfully",
      ...result,
    });
  }
);

export const removeTaskDependencyController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const dependencyId = dependencyIdSchema.parse(req.params.dependencyId);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.MANAGE_TASK_RELATIONS]);

    await removeTaskDependencyService(
      buildRequestContext(req, workspaceId),
      dependencyId
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Task dependency deleted successfully",
    });
  }
);

export const listTaskWatchersController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const taskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await listTaskWatchersService(workspaceId, taskId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Task watchers fetched successfully",
      ...result,
    });
  }
);

export const addTaskWatcherController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const taskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = taskWatcherSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.MANAGE_TASK_RELATIONS]);

    const result = await addTaskWatcherService(
      buildRequestContext(req, workspaceId),
      taskId,
      body.userId
    );

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Task watcher added successfully",
      ...result,
    });
  }
);

export const removeTaskWatcherController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const taskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const watcherUserId = taskIdSchema.parse(req.params.userId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.MANAGE_TASK_RELATIONS]);

    await removeTaskWatcherService(
      buildRequestContext(req, workspaceId),
      taskId,
      watcherUserId
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Task watcher removed successfully",
    });
  }
);

export const watchTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const taskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await addTaskWatcherService(
      buildRequestContext(req, workspaceId),
      taskId,
      userId?.toString()
    );

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Task watched successfully",
      ...result,
    });
  }
);

export const unwatchTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const taskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    await removeTaskWatcherService(
      buildRequestContext(req, workspaceId),
      taskId,
      userId?.toString()
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Task unwatched successfully",
    });
  }
);

export const updateTaskRecurrenceController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const taskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = updateTaskRecurrenceSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.MANAGE_TASK_RELATIONS]);

    const result = await updateTaskRecurrenceService(
      buildRequestContext(req, workspaceId),
      taskId,
      body
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Task recurrence updated successfully",
      ...result,
    });
  }
);

export const clearTaskRecurrenceController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const taskId = taskIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.MANAGE_TASK_RELATIONS]);

    const result = await clearTaskRecurrenceService(
      buildRequestContext(req, workspaceId),
      taskId
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Task recurrence cleared successfully",
      ...result,
    });
  }
);
