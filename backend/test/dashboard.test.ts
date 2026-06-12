import { beforeEach, describe, expect, it } from "vitest";
import MemberModel from "../src/models/member.model";
import RoleModel from "../src/models/roles-permission.model";
import TaskModel from "../src/models/task.model";
import UserModel from "../src/models/user.model";
import WorkspaceModel from "../src/models/workspace.model";
import { Roles } from "../src/enums/role.enum";
import { TaskPriorityEnum, TaskStatusEnum } from "../src/enums/task.enum";
import { phase9TaskCompletedAtMigration } from "../src/migrations/202606120000_phase9_task_completed_at";
import { registerUserService } from "../src/services/auth.service";
import { clearDashboardCacheForTest } from "../src/services/dashboard-cache.service";
import {
  canViewExecutiveDashboard,
  getExecutiveDashboardService,
  getPersonalDashboardService,
  getTeamDashboardService,
} from "../src/services/dashboard.service";
import { createProjectService } from "../src/services/project.service";
import {
  addTaskDependencyService,
  createTaskService,
  updateTaskService,
} from "../src/services/task.service";
import { RequestContext } from "../src/types/request-context";
import { dashboardRangeSchema } from "../src/validation/dashboard.validation";

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

const registerUser = async (email: string, name = "Dashboard User") => {
  const result = await registerUserService({
    email,
    name,
    password,
  });
  const user = await UserModel.findById(result.userId);
  const workspace = await WorkspaceModel.findById(result.workspaceId);

  if (!user || !workspace) {
    throw new Error("Expected registered user and workspace");
  }

  return { user, workspace };
};

const addMemberToWorkspace = async (
  userId: string,
  workspaceId: string,
  roleName = Roles.MEMBER
) => {
  const role = await RoleModel.findOne({ name: roleName });
  if (!role) throw new Error(`Expected ${roleName} role`);
  await MemberModel.create({ userId, workspaceId, role: role._id });
};

const createProject = async (userId: string, workspaceId: string, name: string) => {
  const { project } = await createProjectService(userId, workspaceId, { name });
  return project;
};

const createTask = async ({
  workspaceId,
  projectId,
  userId,
  title,
  status = TaskStatusEnum.TODO,
  assignedTo,
  dueDate,
}: {
  workspaceId: string;
  projectId: string;
  userId: string;
  title: string;
  status?: string;
  assignedTo?: string | null;
  dueDate?: string;
}) => {
  const { task } = await createTaskService(workspaceId, projectId, userId, {
    title,
    priority: TaskPriorityEnum.MEDIUM,
    status,
    assignedTo,
    dueDate,
  });

  return task;
};

describe("dashboard v2 services", () => {
  beforeEach(() => {
    clearDashboardCacheForTest();
  });

  it("sets, clears, and preserves completedAt across task status transitions", async () => {
    const { user, workspace } = await registerUser("dashboard-status@example.com");
    const project = await createProject(
      user._id.toString(),
      workspace._id.toString(),
      "Status Project"
    );
    const task = await createTask({
      workspaceId: workspace._id.toString(),
      projectId: project._id.toString(),
      userId: user._id.toString(),
      title: "Track completed timestamp",
      assignedTo: user._id.toString(),
    });

    const doneResult = await updateTaskService(
      workspace._id.toString(),
      project._id.toString(),
      task._id.toString(),
      { status: TaskStatusEnum.DONE }
    );
    expect(doneResult.updatedTask.completedAt).toBeInstanceOf(Date);
    const firstCompletedAt = doneResult.updatedTask.completedAt?.toISOString();

    const editedDoneResult = await updateTaskService(
      workspace._id.toString(),
      project._id.toString(),
      task._id.toString(),
      { title: "Edited while complete" }
    );
    expect(editedDoneResult.updatedTask.completedAt?.toISOString()).toBe(
      firstCompletedAt
    );

    const reopenedResult = await updateTaskService(
      workspace._id.toString(),
      project._id.toString(),
      task._id.toString(),
      { status: TaskStatusEnum.IN_PROGRESS }
    );
    expect(reopenedResult.updatedTask.completedAt).toBeNull();
  });

  it("backfills completedAt for existing completed tasks idempotently", async () => {
    const { user, workspace } = await registerUser("dashboard-migration@example.com");
    const project = await createProject(
      user._id.toString(),
      workspace._id.toString(),
      "Migration Project"
    );
    const task = await createTask({
      workspaceId: workspace._id.toString(),
      projectId: project._id.toString(),
      userId: user._id.toString(),
      title: "Existing done task",
      status: TaskStatusEnum.DONE,
      assignedTo: user._id.toString(),
    });
    const historicalUpdatedAt = new Date("2026-01-15T10:30:00.000Z");

    await TaskModel.updateOne(
      { _id: task._id },
      {
        $set: {
          status: TaskStatusEnum.DONE,
          completedAt: null,
          updatedAt: historicalUpdatedAt,
        },
      },
      { timestamps: false }
    );

    await phase9TaskCompletedAtMigration.up();
    await phase9TaskCompletedAtMigration.up();

    const migratedTask = await TaskModel.findById(task._id).select(
      "completedAt updatedAt"
    );
    expect(migratedTask?.completedAt?.toISOString()).toBe(
      historicalUpdatedAt.toISOString()
    );
  });

  it("keeps personal dashboard metrics scoped to the current user and workspace", async () => {
    const { user, workspace } = await registerUser("dashboard-personal@example.com");
    const project = await createProject(
      user._id.toString(),
      workspace._id.toString(),
      "Personal Project"
    );
    await createTask({
      workspaceId: workspace._id.toString(),
      projectId: project._id.toString(),
      userId: user._id.toString(),
      title: "Due today",
      assignedTo: user._id.toString(),
      dueDate: dateOffset(0),
    });
    await createTask({
      workspaceId: workspace._id.toString(),
      projectId: project._id.toString(),
      userId: user._id.toString(),
      title: "Overdue",
      assignedTo: user._id.toString(),
      dueDate: dateOffset(-2),
    });
    await createTask({
      workspaceId: workspace._id.toString(),
      projectId: project._id.toString(),
      userId: user._id.toString(),
      title: "Upcoming",
      assignedTo: user._id.toString(),
      dueDate: dateOffset(5),
    });

    const { user: otherOwner, workspace: otherWorkspace } = await registerUser(
      "dashboard-other-workspace@example.com"
    );
    await addMemberToWorkspace(
      user._id.toString(),
      otherWorkspace._id.toString()
    );
    const otherProject = await createProject(
      otherOwner._id.toString(),
      otherWorkspace._id.toString(),
      "Other Workspace Project"
    );
    await createTask({
      workspaceId: otherWorkspace._id.toString(),
      projectId: otherProject._id.toString(),
      userId: otherOwner._id.toString(),
      title: "Must not leak",
      assignedTo: user._id.toString(),
      dueDate: dateOffset(0),
    });

    const dashboard = await getPersonalDashboardService(
      workspace._id.toString(),
      user._id.toString(),
      "30d"
    );

    expect(dashboard.summary).toMatchObject({
      assignedOpenTasks: 3,
      dueToday: 1,
      overdue: 1,
      upcoming: 1,
    });
    expect(dashboard.dueTodayTasks.map((item) => item.title)).not.toContain(
      "Must not leak"
    );
  });

  it("counts only non-completed tasks for team workload", async () => {
    const { user, workspace } = await registerUser("dashboard-workload@example.com");
    const project = await createProject(
      user._id.toString(),
      workspace._id.toString(),
      "Workload Project"
    );
    await createTask({
      workspaceId: workspace._id.toString(),
      projectId: project._id.toString(),
      userId: user._id.toString(),
      title: "Open work",
      assignedTo: user._id.toString(),
    });
    await createTask({
      workspaceId: workspace._id.toString(),
      projectId: project._id.toString(),
      userId: user._id.toString(),
      title: "Completed work",
      status: TaskStatusEnum.DONE,
      assignedTo: user._id.toString(),
    });

    const dashboard = await getTeamDashboardService(
      workspace._id.toString(),
      user._id.toString(),
      "30d"
    );
    const ownerWorkload = dashboard.workload.find(
      (member) => member.userId === user._id.toString()
    );

    expect(ownerWorkload?.openTasks).toBe(1);
    expect(dashboard.summary).toMatchObject({
      totalTasks: 2,
      completedTasks: 1,
      openTasks: 1,
    });
  });

  it("calculates executive project health and velocity from completedAt", async () => {
    const { user, workspace } = await registerUser("dashboard-exec@example.com");
    const project = await createProject(
      user._id.toString(),
      workspace._id.toString(),
      "Executive Project"
    );
    await createTask({
      workspaceId: workspace._id.toString(),
      projectId: project._id.toString(),
      userId: user._id.toString(),
      title: "Completed",
      status: TaskStatusEnum.DONE,
      assignedTo: user._id.toString(),
    });
    const predecessor = await createTask({
      workspaceId: workspace._id.toString(),
      projectId: project._id.toString(),
      userId: user._id.toString(),
      title: "Blocking predecessor",
      assignedTo: user._id.toString(),
    });
    const successor = await createTask({
      workspaceId: workspace._id.toString(),
      projectId: project._id.toString(),
      userId: user._id.toString(),
      title: "Blocked overdue successor",
      assignedTo: user._id.toString(),
      dueDate: dateOffset(-3),
    });

    await addTaskDependencyService(
      contextFor(user._id.toString(), workspace._id.toString()),
      successor._id.toString(),
      predecessor._id.toString()
    );

    const dashboard = await getExecutiveDashboardService(
      workspace._id.toString(),
      user._id.toString(),
      "7d"
    );
    const health = dashboard.projectHealth.find(
      (item) => item.projectId === project._id.toString()
    );

    expect(health?.health.status).toBe("CRITICAL");
    expect(health?.health.score).toBeCloseTo(43.33, 2);
    expect(health?.blockedOpenTasks).toBe(1);
    expect(health?.overdueOpenTasks).toBe(1);
    expect(dashboard.velocity.completedInRange).toBe(1);
  });

  it("restricts executive dashboard access to owners and admins", () => {
    expect(canViewExecutiveDashboard(Roles.OWNER)).toBe(true);
    expect(canViewExecutiveDashboard(Roles.ADMIN)).toBe(true);
    expect(canViewExecutiveDashboard(Roles.MEMBER)).toBe(false);
  });

  it("strictly validates supported dashboard ranges", () => {
    expect(dashboardRangeSchema.parse({}).range).toBe("30d");
    expect(dashboardRangeSchema.parse({ range: "90d" }).range).toBe("90d");
    expect(() => dashboardRangeSchema.parse({ range: "180d" })).toThrow();
  });

  it("uses short TTL cache entries until cache expiry or explicit test clear", async () => {
    const { user, workspace } = await registerUser("dashboard-cache@example.com");
    const project = await createProject(
      user._id.toString(),
      workspace._id.toString(),
      "Cache Project"
    );

    const firstDashboard = await getTeamDashboardService(
      workspace._id.toString(),
      user._id.toString(),
      "30d"
    );
    expect(firstDashboard.summary.totalTasks).toBe(0);

    await createTask({
      workspaceId: workspace._id.toString(),
      projectId: project._id.toString(),
      userId: user._id.toString(),
      title: "Cached task",
      assignedTo: user._id.toString(),
    });

    const cachedDashboard = await getTeamDashboardService(
      workspace._id.toString(),
      user._id.toString(),
      "30d"
    );
    expect(cachedDashboard.summary.totalTasks).toBe(0);

    clearDashboardCacheForTest();
    const refreshedDashboard = await getTeamDashboardService(
      workspace._id.toString(),
      user._id.toString(),
      "30d"
    );
    expect(refreshedDashboard.summary.totalTasks).toBe(1);
  });
});
