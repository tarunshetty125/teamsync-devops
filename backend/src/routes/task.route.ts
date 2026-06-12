import { Router } from "express";
import {
  addChecklistItemController,
  addTaskDependencyController,
  addTaskWatcherController,
  clearTaskRecurrenceController,
  createTaskController,
  createSubtaskController,
  deleteChecklistItemController,
  deleteTaskController,
  getAllTasksController,
  getKanbanTasksController,
  getTaskByIdController,
  listSubtasksController,
  listTaskDependenciesController,
  listTaskWatchersController,
  removeTaskDependencyController,
  removeTaskWatcherController,
  replaceTaskLabelsController,
  unwatchTaskController,
  updateChecklistItemController,
  updateTaskScheduleController,
  updateTaskRecurrenceController,
  updateTaskController,
  watchTaskController,
} from "../controllers/task.controller";
import { writeApiRateLimiter } from "../middlewares/rateLimit.middleware";

const taskRoutes = Router();

taskRoutes.post(
  "/project/:projectId/workspace/:workspaceId/create",
  writeApiRateLimiter,
  createTaskController
);

taskRoutes.delete(
  "/:id/workspace/:workspaceId/delete",
  writeApiRateLimiter,
  deleteTaskController
);

taskRoutes.post(
  "/:id/workspace/:workspaceId/subtasks",
  writeApiRateLimiter,
  createSubtaskController
);
taskRoutes.get("/:id/workspace/:workspaceId/subtasks", listSubtasksController);

taskRoutes.post(
  "/:id/workspace/:workspaceId/checklist",
  writeApiRateLimiter,
  addChecklistItemController
);
taskRoutes.put(
  "/:id/workspace/:workspaceId/checklist/:itemId",
  writeApiRateLimiter,
  updateChecklistItemController
);
taskRoutes.delete(
  "/:id/workspace/:workspaceId/checklist/:itemId",
  writeApiRateLimiter,
  deleteChecklistItemController
);

taskRoutes.put(
  "/:id/workspace/:workspaceId/labels",
  writeApiRateLimiter,
  replaceTaskLabelsController
);

taskRoutes.get(
  "/:id/workspace/:workspaceId/dependencies",
  listTaskDependenciesController
);
taskRoutes.post(
  "/:id/workspace/:workspaceId/dependencies",
  writeApiRateLimiter,
  addTaskDependencyController
);
taskRoutes.delete(
  "/workspace/:workspaceId/dependencies/:dependencyId",
  writeApiRateLimiter,
  removeTaskDependencyController
);

taskRoutes.get("/:id/workspace/:workspaceId/watchers", listTaskWatchersController);
taskRoutes.post(
  "/:id/workspace/:workspaceId/watchers",
  writeApiRateLimiter,
  addTaskWatcherController
);
taskRoutes.delete(
  "/:id/workspace/:workspaceId/watchers/:userId",
  writeApiRateLimiter,
  removeTaskWatcherController
);
taskRoutes.post(
  "/:id/workspace/:workspaceId/watch",
  writeApiRateLimiter,
  watchTaskController
);
taskRoutes.delete(
  "/:id/workspace/:workspaceId/watch",
  writeApiRateLimiter,
  unwatchTaskController
);

taskRoutes.put(
  "/:id/workspace/:workspaceId/recurrence",
  writeApiRateLimiter,
  updateTaskRecurrenceController
);
taskRoutes.delete(
  "/:id/workspace/:workspaceId/recurrence",
  writeApiRateLimiter,
  clearTaskRecurrenceController
);

taskRoutes.put(
  "/:id/workspace/:workspaceId/schedule",
  writeApiRateLimiter,
  updateTaskScheduleController
);

taskRoutes.put(
  "/:id/project/:projectId/workspace/:workspaceId/update",
  writeApiRateLimiter,
  updateTaskController
);

taskRoutes.get("/workspace/:workspaceId/kanban", getKanbanTasksController);

taskRoutes.get("/workspace/:workspaceId/all", getAllTasksController);

taskRoutes.get(
  "/:id/project/:projectId/workspace/:workspaceId",
  getTaskByIdController
);

export default taskRoutes;
