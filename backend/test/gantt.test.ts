import { describe, expect, it } from "vitest";
import ActivityModel from "../src/models/activity.model";
import AuditLogModel from "../src/models/audit-log.model";
import TaskModel from "../src/models/task.model";
import UserModel from "../src/models/user.model";
import WorkspaceModel from "../src/models/workspace.model";
import {
  ActivityTypeEnum,
  DomainEventTypeEnum,
} from "../src/enums/domain.enum";
import { TaskPriorityEnum, TaskStatusEnum } from "../src/enums/task.enum";
import { phase11TaskScheduleDatesMigration } from "../src/migrations/202606120100_phase11_task_schedule_dates";
import { registerUserService } from "../src/services/auth.service";
import {
  addTaskDependencyService,
  createTaskService,
  updateTaskScheduleService,
  updateTaskService,
} from "../src/services/task.service";
import {
  clearDomainEventHandlersForTest,
  registerDomainEventHandler,
} from "../src/services/domain-event.service";
import { createProjectService } from "../src/services/project.service";
import { getGanttService } from "../src/services/gantt.service";
import { getTimelineService } from "../src/services/timeline.service";
import { RequestContext } from "../src/types/request-context";

const password = "Str0ng!Pass";

const contextFor = (userId: string, workspaceId: string): RequestContext => ({
  requestId: `${userId}-${workspaceId}`,
  userId,
  workspaceId,
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
});

const dateOffset = (days: number) => {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString();
};

const dateInput = (days: number) => dateOffset(days).slice(0, 10);

const registerUser = async (email: string) => {
  const result = await registerUserService({
    email,
    name: "Gantt User",
    password,
  });
  const user = await UserModel.findById(result.userId);
  const workspace = await WorkspaceModel.findById(result.workspaceId);

  if (!user || !workspace) {
    throw new Error("Expected user and workspace");
  }

  return { user, workspace };
};

const createProjectAndTask = async (email: string, dueDate = dateOffset(20)) => {
  const { user, workspace } = await registerUser(email);
  const context = contextFor(user._id.toString(), workspace._id.toString());
  const { project } = await createProjectService(
    user._id.toString(),
    workspace._id.toString(),
    { name: "Gantt Project" },
    context
  );
  const { task } = await createTaskService(
    workspace._id.toString(),
    project._id.toString(),
    user._id.toString(),
    {
      title: "Gantt Task",
      priority: TaskPriorityEnum.MEDIUM,
      status: TaskStatusEnum.TODO,
      assignedTo: user._id.toString(),
      dueDate,
    },
    context
  );

  return { user, workspace, project, task, context };
};

describe("gantt scheduling", () => {
  it("backfills existing due-dated tasks and clears scheduling for tasks without dueDate", async () => {
    const { user, workspace, project, context } = await createProjectAndTask(
      "gantt-migration@example.com"
    );
    const { task: dueTask } = await createTaskService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString(),
      {
        title: "Due task",
        priority: TaskPriorityEnum.MEDIUM,
        status: TaskStatusEnum.TODO,
        dueDate: dateOffset(14),
      },
      context
    );
    const { task: unscheduledTask } = await createTaskService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString(),
      {
        title: "No due task",
        priority: TaskPriorityEnum.MEDIUM,
        status: TaskStatusEnum.TODO,
      },
      context
    );

    await TaskModel.updateOne(
      { _id: dueTask._id },
      { $unset: { startDate: "", endDate: "" } }
    );
    await TaskModel.updateOne(
      { _id: unscheduledTask._id },
      {
        $set: {
          startDate: new Date(),
          endDate: new Date(),
        },
      }
    );

    await phase11TaskScheduleDatesMigration.up();
    await phase11TaskScheduleDatesMigration.up();

    const migratedDueTask = await TaskModel.findById(dueTask._id).lean();
    const migratedUnscheduledTask = await TaskModel.findById(
      unscheduledTask._id
    ).lean();

    expect(migratedDueTask?.startDate?.toISOString()).toBe(
      migratedDueTask?.createdAt.toISOString()
    );
    expect(migratedDueTask?.endDate?.toISOString()).toBe(
      migratedDueTask?.dueDate?.toISOString()
    );
    expect(migratedUnscheduledTask?.startDate).toBeNull();
    expect(migratedUnscheduledTask?.endDate).toBeNull();
  });

  it("updates task schedule transactionally and keeps endDate synchronized with dueDate", async () => {
    const { workspace, task, context } = await createProjectAndTask(
      "gantt-schedule@example.com"
    );
    const capturedEvents: string[] = [];
    clearDomainEventHandlersForTest();
    registerDomainEventHandler(DomainEventTypeEnum.TASK_UPDATED, (event) => {
      capturedEvents.push(event.entityId);
    });

    const startDate = dateInput(3);
    const endDate = dateInput(12);
    await updateTaskScheduleService(context, task._id.toString(), {
      startDate,
      endDate,
    });

    const storedTask = await TaskModel.findById(task._id).lean();
    expect(storedTask?.startDate?.toISOString().slice(0, 10)).toBe(startDate);
    expect(storedTask?.endDate?.toISOString().slice(0, 10)).toBe(endDate);
    expect(storedTask?.dueDate?.toISOString().slice(0, 10)).toBe(endDate);
    expect(capturedEvents).toEqual([task._id.toString()]);
    expect(
      await AuditLogModel.countDocuments({
        workspace: workspace._id,
        "metadata.scope": "schedule",
      })
    ).toBe(1);
    expect(
      await ActivityModel.countDocuments({
        workspace: workspace._id,
        type: ActivityTypeEnum.TASK_SCHEDULE_UPDATED,
      })
    ).toBe(1);
  });

  it("keeps dueDate updates synchronized with endDate", async () => {
    const { workspace, project, task, context } = await createProjectAndTask(
      "gantt-due-sync@example.com"
    );

    await updateTaskService(
      workspace._id.toString(),
      project._id.toString(),
      task._id.toString(),
      { dueDate: dateOffset(30) },
      context
    );

    const storedTask = await TaskModel.findById(task._id).lean();
    expect(storedTask?.endDate?.toISOString()).toBe(
      storedTask?.dueDate?.toISOString()
    );
  });

  it("computes dependency warnings dynamically without changing Timeline behavior", async () => {
    const { user, workspace, project, context } = await createProjectAndTask(
      "gantt-warnings@example.com"
    );
    const { task: predecessor } = await createTaskService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString(),
      {
        title: "Predecessor",
        priority: TaskPriorityEnum.MEDIUM,
        status: TaskStatusEnum.TODO,
        dueDate: dateOffset(10),
      },
      context
    );
    const { task: successor } = await createTaskService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString(),
      {
        title: "Successor",
        priority: TaskPriorityEnum.MEDIUM,
        status: TaskStatusEnum.TODO,
        dueDate: dateOffset(20),
      },
      context
    );

    await updateTaskScheduleService(context, successor._id.toString(), {
      startDate: dateInput(5),
      endDate: dateInput(20),
    });
    await addTaskDependencyService(
      context,
      successor._id.toString(),
      predecessor._id.toString()
    );

    const gantt = await getGanttService(workspace._id.toString(), {
      range: "30d",
    });
    const ganttSuccessor = gantt.tasks.find(
      (item) => item._id === successor._id.toString()
    );

    expect(ganttSuccessor?.blockedByCount).toBe(1);
    expect(ganttSuccessor?.isBlocked).toBe(true);
    expect(ganttSuccessor?.dependencyWarnings).toHaveLength(1);
    const storedSuccessor = await TaskModel.findById(successor._id)
      .select("dependencyWarnings isBlocked blockedByCount")
      .lean();
    expect(storedSuccessor).not.toHaveProperty("dependencyWarnings");

    const timeline = await getTimelineService(workspace._id.toString(), {
      range: "30d",
      startDate: dateInput(2),
      endDate: dateInput(12),
    });
    const timelineSuccessor = timeline.tasks.find(
      (item) => item._id === successor._id.toString()
    );
    expect(timelineSuccessor?.barStart.toISOString()).toBe(
      timeline.range.startDate.toISOString()
    );
  });
});
