import { beforeEach, describe, expect, it, vi } from "vitest";
import LabelModel from "../src/models/label.model";
import MemberModel from "../src/models/member.model";
import NotificationModel from "../src/models/notification.model";
import ProjectModel from "../src/models/project.model";
import RoleModel from "../src/models/roles-permission.model";
import TaskDependencyModel from "../src/models/task-dependency.model";
import TaskModel from "../src/models/task.model";
import TaskWatcherModel from "../src/models/task-watcher.model";
import UserModel from "../src/models/user.model";
import WorkspaceModel from "../src/models/workspace.model";
import { NotificationTypeEnum } from "../src/enums/domain.enum";
import { Roles } from "../src/enums/role.enum";
import {
  TaskPriorityEnum,
  TaskRecurrenceFrequencyEnum,
  TaskStatusEnum,
} from "../src/enums/task.enum";
import { registerUserService } from "../src/services/auth.service";
import {
  addChecklistItemService,
  addTaskDependencyService,
  addTaskWatcherService,
  clearTaskRecurrenceService,
  createSubtaskService,
  createTaskService,
  deleteChecklistItemService,
  deleteTaskService,
  getKanbanTasksService,
  getTaskByIdService,
  listTaskDependenciesService,
  listTaskWatchersService,
  removeTaskDependencyService,
  removeTaskWatcherService,
  replaceTaskLabelsService,
  updateChecklistItemService,
  updateTaskRecurrenceService,
  updateTaskService,
} from "../src/services/task.service";
import {
  createLabelService,
  listLabelsService,
  softDeleteLabelService,
  updateLabelService,
} from "../src/services/label.service";
import { createProjectService } from "../src/services/project.service";
import {
  clearDomainEventHandlersForTest,
} from "../src/services/domain-event.service";
import {
  registerNotificationEventHandlers,
  resetNotificationEventHandlersForTest,
} from "../src/services/notification-event-handlers.service";
import { RequestContext } from "../src/types/request-context";

const password = "Str0ng!Pass";

const contextFor = (userId: string, workspaceId: string): RequestContext => ({
  requestId: `${userId}-${workspaceId}`,
  userId,
  workspaceId,
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
});

const registerUser = async (email: string, name = "Advanced User") => {
  const result = await registerUserService({
    email,
    name,
    password,
  });
  const user = await UserModel.findById(result.userId);
  const workspace = await WorkspaceModel.findById(result.workspaceId);

  if (!user || !workspace) {
    throw new Error("Expected user and workspace");
  }

  return { user, workspace };
};

const addMemberToWorkspace = async (userId: string, workspaceId: string) => {
  const role = await RoleModel.findOne({ name: Roles.MEMBER });
  if (!role) throw new Error("Expected member role");
  await MemberModel.create({ userId, workspaceId, role: role._id });
};

const createProjectAndTask = async (email: string) => {
  const { user, workspace } = await registerUser(email);
  const context = contextFor(user._id.toString(), workspace._id.toString());
  const { project } = await createProjectService(
    user._id.toString(),
    workspace._id.toString(),
    { name: "Advanced Project" },
    context
  );
  const { task } = await createTaskService(
    workspace._id.toString(),
    project._id.toString(),
    user._id.toString(),
    {
      title: "Advanced Task",
      priority: TaskPriorityEnum.MEDIUM,
      status: TaskStatusEnum.TODO,
      assignedTo: user._id.toString(),
      dueDate: "2026-07-01",
    },
    context
  );

  return { user, workspace, project, task, context };
};

describe("advanced task foundations", () => {
  beforeEach(() => {
    clearDomainEventHandlersForTest();
    resetNotificationEventHandlersForTest();
    registerNotificationEventHandlers();
  });

  it("uses task hierarchy for subtasks and enforces max depth 3", async () => {
    const { user, workspace, task, context } = await createProjectAndTask(
      "subtasks@example.com"
    );

    const child = await createSubtaskService(
      workspace._id.toString(),
      task._id.toString(),
      user._id.toString(),
      { title: "Depth 1" },
      context
    );
    const grandchild = await createSubtaskService(
      workspace._id.toString(),
      child.subtask._id.toString(),
      user._id.toString(),
      { title: "Depth 2" },
      context
    );
    const greatGrandchild = await createSubtaskService(
      workspace._id.toString(),
      grandchild.subtask._id.toString(),
      user._id.toString(),
      { title: "Depth 3" },
      context
    );

    expect(greatGrandchild.subtask.subtaskDepth).toBe(3);
    await expect(
      createSubtaskService(
        workspace._id.toString(),
        greatGrandchild.subtask._id.toString(),
        user._id.toString(),
        { title: "Depth 4" },
        context
      )
    ).rejects.toThrow(/maximum subtask depth/i);
  });

  it("soft-deletes labels without removing retained task label ids", async () => {
    const { workspace, task, context } = await createProjectAndTask(
      "labels@example.com"
    );
    const label = await LabelModel.create({
      workspace: workspace._id,
      name: "Design",
      color: "#2563eb",
      createdBy: context.userId,
    });

    await replaceTaskLabelsService(context, task._id.toString(), [
      label._id.toString(),
    ]);
    await LabelModel.updateOne(
      { _id: label._id },
      { $set: { deletedAt: new Date(), deletedBy: context.userId } }
    );

    const storedTask = await TaskModel.findById(task._id).select("labels");
    expect(storedTask?.labels.map((id) => id.toString())).toContain(
      label._id.toString()
    );

    const fetchedTask = await getTaskByIdService(
      workspace._id.toString(),
      task.project.toString(),
      task._id.toString()
    );
    expect(fetchedTask.labels).toHaveLength(0);
  });

  it("validates finish-to-start dependencies and exposes computed counts", async () => {
    const { user, workspace, project, task, context } = await createProjectAndTask(
      "dependencies@example.com"
    );
    const { task: predecessor } = await createTaskService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString(),
      {
        title: "Predecessor",
        priority: TaskPriorityEnum.HIGH,
        status: TaskStatusEnum.TODO,
      },
      context
    );

    await addTaskDependencyService(
      context,
      task._id.toString(),
      predecessor._id.toString()
    );
    await expect(
      addTaskDependencyService(
        context,
        task._id.toString(),
        predecessor._id.toString()
      )
    ).rejects.toThrow(/already exists/i);
    await expect(
      addTaskDependencyService(context, task._id.toString(), task._id.toString())
    ).rejects.toThrow(/itself/i);
    await expect(
      addTaskDependencyService(
        context,
        predecessor._id.toString(),
        task._id.toString()
      )
    ).rejects.toThrow(/cycle/i);

    const dependencies = await listTaskDependenciesService(
      workspace._id.toString(),
      task._id.toString()
    );
    expect(dependencies.dependencySummary).toMatchObject({
      blockedByCount: 1,
      incompleteBlockingCount: 1,
      isBlocked: true,
    });
  });

  it("generates recurring task occurrences with trace id and strict clone exclusions", async () => {
    const { user, workspace, project, task, context } = await createProjectAndTask(
      "recurrence@example.com"
    );
    const label = await LabelModel.create({
      workspace: workspace._id,
      name: "Recurring",
      color: "#16a34a",
      createdBy: user._id,
    });
    const subtask = await createSubtaskService(
      workspace._id.toString(),
      task._id.toString(),
      user._id.toString(),
      { title: "Do not clone" },
      context
    );
    const { task: predecessor } = await createTaskService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString(),
      {
        title: "Dependency",
        priority: TaskPriorityEnum.LOW,
        status: TaskStatusEnum.TODO,
      },
      context
    );

    await replaceTaskLabelsService(context, task._id.toString(), [
      label._id.toString(),
    ]);
    await addChecklistItemService(context, task._id.toString(), "Do not clone");
    await addTaskDependencyService(
      context,
      task._id.toString(),
      predecessor._id.toString()
    );
    await addTaskWatcherService(context, task._id.toString(), user._id.toString());
    await updateTaskRecurrenceService(context, task._id.toString(), {
      enabled: true,
      frequency: TaskRecurrenceFrequencyEnum.WEEKLY,
      interval: 1,
      maxOccurrences: 3,
    });

    const { generatedTask } = await updateTaskService(
      workspace._id.toString(),
      project._id.toString(),
      task._id.toString(),
      { status: TaskStatusEnum.DONE },
      context
    );

    expect(generatedTask?.generatedFromTaskId?.toString()).toBe(
      task._id.toString()
    );
    expect(generatedTask?.status).toBe(TaskStatusEnum.TODO);
    expect(generatedTask?.labels.map((id) => id.toString())).toEqual([
      label._id.toString(),
    ]);
    expect(generatedTask?.checklist).toHaveLength(0);
    expect(
      await TaskDependencyModel.countDocuments({
        successorTask: generatedTask?._id,
        deletedAt: null,
      })
    ).toBe(0);
    expect(
      await TaskModel.countDocuments({
        parentTask: generatedTask?._id,
      })
    ).toBe(0);
    expect(
      await TaskModel.exists({
        _id: subtask.subtask._id,
      })
    ).toBeTruthy();

    const secondCompletion = await updateTaskService(
      workspace._id.toString(),
      project._id.toString(),
      task._id.toString(),
      { status: TaskStatusEnum.DONE },
      context
    );
    expect(secondCompletion.generatedTask).toBeNull();
  });

  it("notifies watchers only for material task changes", async () => {
    const { user, workspace, project, task, context } = await createProjectAndTask(
      "watchers@example.com"
    );
    const { user: watcher } = await registerUser("watcher@example.com");
    await addMemberToWorkspace(watcher._id.toString(), workspace._id.toString());
    await addTaskWatcherService(
      context,
      task._id.toString(),
      watcher._id.toString()
    );

    await updateTaskService(
      workspace._id.toString(),
      project._id.toString(),
      task._id.toString(),
      { priority: TaskPriorityEnum.HIGH },
      context
    );
    expect(
      await NotificationModel.countDocuments({
        recipient: watcher._id,
        type: NotificationTypeEnum.TASK_UPDATED,
      })
    ).toBe(1);

    const label = await LabelModel.create({
      workspace: workspace._id,
      name: "Quiet",
      color: "#d97706",
      createdBy: user._id,
    });
    await replaceTaskLabelsService(context, task._id.toString(), [
      label._id.toString(),
    ]);
    expect(
      await NotificationModel.countDocuments({
        recipient: watcher._id,
        type: NotificationTypeEnum.TASK_UPDATED,
      })
    ).toBe(1);
  });

  it("rolls back recursive delete cleanup when dependency or watcher cleanup fails", async () => {
    const { user, workspace, task, context } = await createProjectAndTask(
      "rollback@example.com"
    );
    const child = await createSubtaskService(
      workspace._id.toString(),
      task._id.toString(),
      user._id.toString(),
      { title: "Child" },
      context
    );
    await addTaskWatcherService(context, child.subtask._id.toString(), user._id.toString());
    const updateManySpy = vi
      .spyOn(TaskWatcherModel, "updateMany")
      .mockImplementationOnce(
        () =>
          ({
            session: () => Promise.reject(new Error("watcher cleanup failed")),
          }) as ReturnType<typeof TaskWatcherModel.updateMany>
      );

    await expect(
      deleteTaskService(
        workspace._id.toString(),
        task._id.toString(),
        user._id.toString()
      )
    ).rejects.toThrow(/watcher cleanup failed/i);

    expect(await TaskModel.findById(task._id)).toBeTruthy();
    expect(await TaskModel.findById(child.subtask._id)).toBeTruthy();
    expect(
      await TaskWatcherModel.countDocuments({
        task: child.subtask._id,
        deletedAt: null,
      })
    ).toBeGreaterThan(0);

    updateManySpy.mockRestore();
  });

  it("cleans dependencies and watchers when deleting a task hierarchy", async () => {
    const { user, workspace, project, task, context } = await createProjectAndTask(
      "delete-tree@example.com"
    );
    const child = await createSubtaskService(
      workspace._id.toString(),
      task._id.toString(),
      user._id.toString(),
      { title: "Child" },
      context
    );
    const { task: predecessor } = await createTaskService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString(),
      {
        title: "Predecessor",
        priority: TaskPriorityEnum.LOW,
        status: TaskStatusEnum.TODO,
      },
      context
    );
    await addTaskDependencyService(
      context,
      child.subtask._id.toString(),
      predecessor._id.toString()
    );
    await addTaskWatcherService(context, child.subtask._id.toString(), user._id.toString());

    await deleteTaskService(
      workspace._id.toString(),
      task._id.toString(),
      user._id.toString()
    );

    expect(await TaskModel.findById(task._id)).toBeNull();
    expect(await TaskModel.findById(child.subtask._id)).toBeNull();
    expect(
      await TaskDependencyModel.countDocuments({
        successorTask: child.subtask._id,
        deletedAt: null,
      })
    ).toBe(0);
    expect(
      await TaskWatcherModel.countDocuments({
        task: child.subtask._id,
        deletedAt: null,
      })
    ).toBe(0);
  });

  it("covers label CRUD, checklist removal, watcher removal, dependency removal, and recurrence clearing", async () => {
    const { user, workspace, project, task, context } = await createProjectAndTask(
      "advanced-crud@example.com"
    );
    const { task: predecessor } = await createTaskService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString(),
      {
        title: "Removable predecessor",
        priority: TaskPriorityEnum.LOW,
        status: TaskStatusEnum.TODO,
      },
      context
    );

    const { label } = await createLabelService(context, {
      name: "CRUD Label",
      color: "#2563eb",
    });
    const updatedLabel = await updateLabelService(context, label._id.toString(), {
      name: "CRUD Label Updated",
      color: "#16a34a",
    });
    expect(updatedLabel.label.name).toBe("CRUD Label Updated");
    expect(
      (
        await listLabelsService(workspace._id.toString(), {
          pageNumber: 1,
          pageSize: 20,
        })
      ).labels
    ).toHaveLength(1);
    await softDeleteLabelService(context, label._id.toString());
    expect(
      (
        await listLabelsService(workspace._id.toString(), {
          pageNumber: 1,
          pageSize: 20,
        })
      ).labels
    ).toHaveLength(0);

    const checklist = await addChecklistItemService(
      context,
      task._id.toString(),
      "Temporary checklist"
    );
    const itemId = checklist.checklist[0]._id.toString();
    await updateChecklistItemService(context, task._id.toString(), itemId, {
      text: "Updated checklist",
      completed: true,
    });
    const removedChecklist = await deleteChecklistItemService(
      context,
      task._id.toString(),
      itemId
    );
    expect(removedChecklist.checklist).toHaveLength(0);

    const dependency = await addTaskDependencyService(
      context,
      task._id.toString(),
      predecessor._id.toString()
    );
    await removeTaskDependencyService(context, dependency.dependency._id.toString());
    expect(
      await TaskDependencyModel.countDocuments({
        _id: dependency.dependency._id,
        deletedAt: null,
      })
    ).toBe(0);

    const watcher = await addTaskWatcherService(
      context,
      task._id.toString(),
      user._id.toString()
    );
    expect(
      (await listTaskWatchersService(workspace._id.toString(), task._id.toString()))
        .watchers.length
    ).toBeGreaterThan(0);
    await removeTaskWatcherService(
      context,
      task._id.toString(),
      user._id.toString()
    );
    expect(
      await TaskWatcherModel.countDocuments({
        _id: watcher.watcher._id,
        deletedAt: null,
      })
    ).toBe(0);

    await updateTaskRecurrenceService(context, task._id.toString(), {
      enabled: true,
      frequency: TaskRecurrenceFrequencyEnum.DAILY,
      interval: 2,
    });
    const cleared = await clearTaskRecurrenceService(context, task._id.toString());
    expect(cleared.task.recurrence.enabled).toBe(false);
  });

  it("returns Kanban columns with counts, cursors, and dependency indicators", async () => {
    const { user, workspace, project, task, context } = await createProjectAndTask(
      "kanban-board@example.com"
    );
    const { task: predecessor } = await createTaskService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString(),
      {
        title: "Kanban predecessor",
        priority: TaskPriorityEnum.HIGH,
        status: TaskStatusEnum.TODO,
      },
      context
    );
    const { task: inProgressTask } = await createTaskService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString(),
      {
        title: "Kanban in progress",
        priority: TaskPriorityEnum.LOW,
        status: TaskStatusEnum.IN_PROGRESS,
      },
      context
    );

    await addTaskDependencyService(
      context,
      task._id.toString(),
      predecessor._id.toString()
    );

    const board = await getKanbanTasksService(workspace._id.toString(), {
      projectId: project._id.toString(),
      columnLimit: 10,
    });

    expect(board.columns).toHaveLength(Object.values(TaskStatusEnum).length);
    expect(board.columnCounts[TaskStatusEnum.TODO]).toBe(2);
    expect(board.columnCounts[TaskStatusEnum.IN_PROGRESS]).toBe(1);

    const todoColumn = board.columns.find(
      (column) => column.status === TaskStatusEnum.TODO
    );
    const blockedCard = todoColumn?.tasks.find(
      (columnTask) => columnTask._id.toString() === task._id.toString()
    );

    expect(blockedCard?.isBlocked).toBe(true);
    expect(blockedCard?.blockedByCount).toBe(1);

    const firstTodoPage = await getKanbanTasksService(workspace._id.toString(), {
      projectId: project._id.toString(),
      status: TaskStatusEnum.TODO,
      columnLimit: 1,
    });
    expect(firstTodoPage.columns).toHaveLength(1);
    expect(firstTodoPage.columns[0].totalCount).toBe(2);
    expect(firstTodoPage.columns[0].hasMore).toBe(true);
    expect(firstTodoPage.columns[0].nextCursor).toEqual(expect.any(String));

    const secondTodoPage = await getKanbanTasksService(workspace._id.toString(), {
      projectId: project._id.toString(),
      status: TaskStatusEnum.TODO,
      cursor: firstTodoPage.columns[0].nextCursor || undefined,
      columnLimit: 1,
    });

    expect(secondTodoPage.columns[0].tasks).toHaveLength(1);
    expect(secondTodoPage.columns[0].tasks[0]._id.toString()).not.toBe(
      firstTodoPage.columns[0].tasks[0]._id.toString()
    );
    expect(
      board.columns
        .find((column) => column.status === TaskStatusEnum.IN_PROGRESS)
        ?.tasks.some(
          (columnTask) =>
            columnTask._id.toString() === inProgressTask._id.toString()
        )
    ).toBe(true);
  });
});
