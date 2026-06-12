import { describe, expect, it } from "vitest";
import ActivityModel from "../src/models/activity.model";
import AuditLogModel from "../src/models/audit-log.model";
import MemberModel from "../src/models/member.model";
import RoleModel from "../src/models/roles-permission.model";
import TaskModel from "../src/models/task.model";
import TimeEntryModel from "../src/models/time-entry.model";
import UserModel from "../src/models/user.model";
import WorkspaceModel from "../src/models/workspace.model";
import {
  ActivityTypeEnum,
  TimeEntrySourceEnum,
} from "../src/enums/domain.enum";
import { Roles } from "../src/enums/role.enum";
import { TaskPriorityEnum, TaskStatusEnum } from "../src/enums/task.enum";
import { phase12ProductivityMigration } from "../src/migrations/202606120200_phase12_productivity";
import { registerUserService } from "../src/services/auth.service";
import { createProjectService, deleteProjectService } from "../src/services/project.service";
import { createTaskService, deleteTaskService } from "../src/services/task.service";
import {
  createManualTimeEntryService,
  getProductivityCapacityService,
  startTimerService,
  stopTimerService,
  updateMemberCapacityService,
  updateTimeEntryService,
} from "../src/services/time.service";
import { RequestContext } from "../src/types/request-context";

const password = "Str0ng!Pass";

const contextFor = (userId: string, workspaceId: string): RequestContext => ({
  requestId: `${userId}-${workspaceId}`,
  userId,
  workspaceId,
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
});

const dateOffset = (hours: number) => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

const registerUser = async (email: string, name = "Productivity User") => {
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

const addMember = async (
  userId: string,
  workspaceId: string,
  roleName = Roles.MEMBER
) => {
  const role = await RoleModel.findOne({ name: roleName });

  if (!role) {
    throw new Error("Expected role");
  }

  return MemberModel.create({
    userId,
    workspaceId,
    role: role._id,
  });
};

const createProjectAndTask = async (email: string) => {
  const { user, workspace } = await registerUser(email);
  const context = contextFor(user._id.toString(), workspace._id.toString());
  const { project } = await createProjectService(
    user._id.toString(),
    workspace._id.toString(),
    { name: "Productivity Project" },
    context
  );
  const { task } = await createTaskService(
    workspace._id.toString(),
    project._id.toString(),
    user._id.toString(),
    {
      title: "Trackable Task",
      priority: TaskPriorityEnum.MEDIUM,
      status: TaskStatusEnum.TODO,
      assignedTo: user._id.toString(),
      dueDate: dateOffset(24),
    },
    context
  );

  return { user, workspace, project, task, context };
};

describe("productivity time tracking", () => {
  it("allows one active timer per user/workspace and returns conflict payload", async () => {
    const { workspace, task, context } = await createProjectAndTask(
      "timer-conflict@example.com"
    );

    const first = await startTimerService(context, {
      taskId: task._id.toString(),
      note: "Focused work",
    });
    const duplicate = await startTimerService(context, {
      taskId: task._id.toString(),
    });

    expect(first.conflict).toBe(false);
    expect(duplicate.conflict).toBe(true);
    expect(duplicate.activeTimer?.task).toBe(task._id.toString());
    expect(
      await TimeEntryModel.countDocuments({
        workspace: workspace._id,
        source: TimeEntrySourceEnum.TIMER,
        endedAt: null,
        deletedAt: null,
      })
    ).toBe(1);

    const stopped = await stopTimerService(context);
    expect(stopped.timeEntry.endedAt).toBeTruthy();
    expect(
      await ActivityModel.countDocuments({
        workspace: workspace._id,
        type: ActivityTypeEnum.TIMER_STOPPED,
      })
    ).toBe(1);
    expect(
      await AuditLogModel.countDocuments({
        workspace: workspace._id,
      })
    ).toBeGreaterThanOrEqual(2);
  });

  it("enforces own-entry and owner/admin correction rules", async () => {
    const ownerSetup = await createProjectAndTask("time-owner@example.com");
    const member = await registerUser("time-member@example.com", "Member");
    await addMember(
      member.user._id.toString(),
      ownerSetup.workspace._id.toString(),
      Roles.MEMBER
    );
    const memberContext = contextFor(
      member.user._id.toString(),
      ownerSetup.workspace._id.toString()
    );
    const ownerContext = contextFor(
      ownerSetup.user._id.toString(),
      ownerSetup.workspace._id.toString()
    );

    const created = await createManualTimeEntryService(memberContext, {
      taskId: ownerSetup.task._id.toString(),
      startedAt: dateOffset(-2),
      endedAt: dateOffset(-1),
      note: "Original",
    });
    const ownerEntry = await createManualTimeEntryService(ownerContext, {
      taskId: ownerSetup.task._id.toString(),
      startedAt: dateOffset(-4),
      endedAt: dateOffset(-3),
      note: "Owner entry",
    });

    await expect(
      updateTimeEntryService(
        memberContext,
        { role: Roles.MEMBER, userId: member.user._id.toString() },
        ownerEntry.timeEntry._id,
        { note: "Bad edit" }
      )
    ).rejects.toThrow(/another member/i);

    const corrected = await updateTimeEntryService(
      ownerContext,
      { role: Roles.OWNER, userId: ownerSetup.user._id.toString() },
      created.timeEntry._id,
      { note: "Corrected" }
    );

    expect(corrected.timeEntry.note).toBe("Corrected");
  });

  it("rejects cross-workspace task targets", async () => {
    const ownerSetup = await createProjectAndTask("time-cross-a@example.com");
    const otherSetup = await createProjectAndTask("time-cross-b@example.com");

    await expect(
      createManualTimeEntryService(ownerSetup.context, {
        taskId: otherSetup.task._id.toString(),
        startedAt: dateOffset(-2),
        endedAt: dateOffset(-1),
      })
    ).rejects.toThrow(/task not found/i);
  });

  it("calculates capacity with tracked seconds using the locked formula", async () => {
    const { workspace, task, context } = await createProjectAndTask(
      "time-capacity@example.com"
    );
    const member = await MemberModel.findOne({
      workspaceId: workspace._id,
      userId: context.userId,
    });

    if (!member) {
      throw new Error("Expected member");
    }

    await updateMemberCapacityService(context, member._id.toString(), 35);
    await createManualTimeEntryService(context, {
      taskId: task._id.toString(),
      startedAt: dateOffset(-2),
      endedAt: dateOffset(-1),
    });

    const capacity = await getProductivityCapacityService(
      workspace._id.toString(),
      "7d"
    );
    const ownerCapacity = capacity.members.find(
      (item) => item.userId === context.userId
    );

    expect(ownerCapacity?.trackedSeconds).toBe(3600);
    expect(ownerCapacity?.capacitySeconds).toBe(35 * 3600);
    expect(ownerCapacity?.utilizationPercent).toBe(3);
  });

  it("preserves historical time rows when tasks and projects are deleted", async () => {
    const { workspace, project, task, context, user } =
      await createProjectAndTask("time-history@example.com");

    await createManualTimeEntryService(context, {
      taskId: task._id.toString(),
      startedAt: dateOffset(-2),
      endedAt: dateOffset(-1),
      note: "Historical task work",
    });
    await deleteTaskService(
      workspace._id.toString(),
      task._id.toString(),
      user._id.toString(),
      context
    );

    const taskHistory = await TimeEntryModel.findOne({
      workspace: workspace._id,
      note: "Historical task work",
    }).lean();
    expect(taskHistory?.task).toBeNull();
    expect(taskHistory?.project?.toString()).toBe(project._id.toString());
    expect(taskHistory?.taskTitle).toBe("Trackable Task");

    const nextTask = await TaskModel.create({
      title: "Project History Task",
      workspace: workspace._id,
      project: project._id,
      createdBy: user._id,
    });
    await createManualTimeEntryService(context, {
      taskId: nextTask._id.toString(),
      startedAt: dateOffset(-4),
      endedAt: dateOffset(-3),
      note: "Historical project work",
    });
    await deleteProjectService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString()
    );

    const projectHistory = await TimeEntryModel.findOne({
      workspace: workspace._id,
      note: "Historical project work",
    }).lean();
    expect(projectHistory?.task).toBeNull();
    expect(projectHistory?.project).toBeNull();
    expect(projectHistory?.projectName).toBe("Productivity Project");
    expect(await TimeEntryModel.countDocuments({ workspace: workspace._id })).toBe(2);
  });

  it("migration backfills capacity and refreshes role permissions", async () => {
    const { workspace, user } = await registerUser("time-migration@example.com");
    await MemberModel.updateOne(
      { workspaceId: workspace._id, userId: user._id },
      { $unset: { capacityHoursPerWeek: "" } }
    );

    await phase12ProductivityMigration.up();
    await phase12ProductivityMigration.up();

    const member = await MemberModel.findOne({
      workspaceId: workspace._id,
      userId: user._id,
    }).lean();
    const ownerRole = await RoleModel.findOne({ name: Roles.OWNER }).lean();

    expect(member?.capacityHoursPerWeek).toBe(40);
    expect(ownerRole?.permissions).toContain("MANAGE_CAPACITY");
  });
});
