import { describe, expect, it } from "vitest";
import LabelModel from "../src/models/label.model";
import MemberModel from "../src/models/member.model";
import MilestoneModel from "../src/models/milestone.model";
import RoleModel from "../src/models/roles-permission.model";
import WorkspaceModel from "../src/models/workspace.model";
import UserModel from "../src/models/user.model";
import { MilestoneStatusEnum } from "../src/enums/domain.enum";
import { Roles } from "../src/enums/role.enum";
import { TaskPriorityEnum, TaskStatusEnum } from "../src/enums/task.enum";
import { registerUserService } from "../src/services/auth.service";
import {
  createMilestoneService,
  deleteMilestoneService,
  listMilestonesService,
  updateMilestoneService,
} from "../src/services/milestone.service";
import { createProjectService } from "../src/services/project.service";
import {
  addTaskDependencyService,
  createTaskService,
  replaceTaskLabelsService,
} from "../src/services/task.service";
import { getTimelineService } from "../src/services/timeline.service";
import { RequestContext } from "../src/types/request-context";
import { timelineQuerySchema } from "../src/validation/timeline.validation";

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

const startOfDateInput = (days: number) => dateOffset(days).slice(0, 10);

const registerUser = async (email: string, name = "Timeline User") => {
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

describe("timeline and milestone services", () => {
  it("creates, updates, lists, and soft-deletes milestones", async () => {
    const { user, workspace } = await registerUser("milestone-crud@example.com");
    const project = await createProject(
      user._id.toString(),
      workspace._id.toString(),
      "Milestone Project"
    );
    const context = contextFor(user._id.toString(), workspace._id.toString());

    const { milestone } = await createMilestoneService(
      workspace._id.toString(),
      user._id.toString(),
      {
        project: project._id.toString(),
        name: "Beta Launch",
        status: MilestoneStatusEnum.PLANNED,
        startDate: startOfDateInput(1),
        dueDate: startOfDateInput(30),
      },
      context
    );
    expect(milestone.name).toBe("Beta Launch");

    const list = await listMilestonesService(workspace._id.toString());
    expect(list.milestones).toHaveLength(1);

    const updated = await updateMilestoneService(
      workspace._id.toString(),
      milestone._id,
      {
        status: MilestoneStatusEnum.COMPLETED,
      },
      context
    );
    expect(updated.milestone.status).toBe(MilestoneStatusEnum.COMPLETED);
    expect(updated.milestone.completedAt).toBeTruthy();

    await deleteMilestoneService(
      workspace._id.toString(),
      milestone._id,
      user._id.toString(),
      context
    );
    expect((await listMilestonesService(workspace._id.toString())).milestones).toHaveLength(0);
    const stored = await MilestoneModel.findById(milestone._id).select("deletedAt");
    expect(stored?.deletedAt).toBeTruthy();
  });

  it("rejects cross-workspace milestone project references", async () => {
    const { user, workspace } = await registerUser("milestone-owner@example.com");
    const { user: otherUser, workspace: otherWorkspace } = await registerUser(
      "milestone-other@example.com"
    );
    const otherProject = await createProject(
      otherUser._id.toString(),
      otherWorkspace._id.toString(),
      "Other Project"
    );

    await expect(
      createMilestoneService(workspace._id.toString(), user._id.toString(), {
        project: otherProject._id.toString(),
        name: "Cross Workspace",
        status: MilestoneStatusEnum.PLANNED,
      })
    ).rejects.toThrow(/does not belong/i);
  });

  it("aggregates clipped task bars, milestones, projects, and dependencies", async () => {
    const { user, workspace } = await registerUser("timeline-aggregate@example.com");
    const project = await createProject(
      user._id.toString(),
      workspace._id.toString(),
      "Timeline Project"
    );
    const context = contextFor(user._id.toString(), workspace._id.toString());
    const predecessor = await createTask({
      workspaceId: workspace._id.toString(),
      projectId: project._id.toString(),
      userId: user._id.toString(),
      title: "Dependency source",
      assignedTo: user._id.toString(),
      dueDate: dateOffset(7),
    });
    const successor = await createTask({
      workspaceId: workspace._id.toString(),
      projectId: project._id.toString(),
      userId: user._id.toString(),
      title: "Clipped task",
      assignedTo: user._id.toString(),
      dueDate: dateOffset(20),
    });
    await createTask({
      workspaceId: workspace._id.toString(),
      projectId: project._id.toString(),
      userId: user._id.toString(),
      title: "No due date",
      assignedTo: user._id.toString(),
    });
    await addTaskDependencyService(
      context,
      successor._id.toString(),
      predecessor._id.toString()
    );
    await createMilestoneService(
      workspace._id.toString(),
      user._id.toString(),
      {
        project: project._id.toString(),
        name: "Visible Milestone",
        status: MilestoneStatusEnum.IN_PROGRESS,
        startDate: startOfDateInput(3),
        dueDate: startOfDateInput(9),
      },
      context
    );

    const startDate = startOfDateInput(2);
    const endDate = startOfDateInput(10);
    const timeline = await getTimelineService(workspace._id.toString(), {
      range: "30d",
      startDate,
      endDate,
    });

    expect(timeline.projects.map((item) => item._id)).toContain(
      project._id.toString()
    );
    expect(timeline.tasks.map((item) => item.title)).toEqual(
      expect.arrayContaining(["Dependency source", "Clipped task"])
    );
    expect(timeline.tasks.map((item) => item.title)).not.toContain("No due date");
    expect(timeline.dependencies).toHaveLength(1);
    expect(timeline.milestones.map((item) => item.name)).toContain(
      "Visible Milestone"
    );

    const clippedTask = timeline.tasks.find((item) => item.title === "Clipped task");
    expect(clippedTask?.barStart.toISOString()).toBe(
      timeline.range.startDate.toISOString()
    );
    expect(clippedTask?.barEnd.toISOString()).toBe(
      timeline.range.endDate.toISOString()
    );
  });

  it("filters timeline data by project, assignee, label, and status", async () => {
    const { user, workspace } = await registerUser("timeline-filter@example.com");
    const { user: member } = await registerUser("timeline-member@example.com");
    await addMemberToWorkspace(member._id.toString(), workspace._id.toString());
    const project = await createProject(
      user._id.toString(),
      workspace._id.toString(),
      "Filtered Project"
    );
    const otherProject = await createProject(
      user._id.toString(),
      workspace._id.toString(),
      "Other Project"
    );
    const context = contextFor(user._id.toString(), workspace._id.toString());
    const label = await LabelModel.create({
      workspace: workspace._id,
      name: "Planning",
      color: "#2563eb",
      createdBy: user._id,
    });
    const matchingTask = await createTask({
      workspaceId: workspace._id.toString(),
      projectId: project._id.toString(),
      userId: user._id.toString(),
      title: "Matching task",
      status: TaskStatusEnum.IN_PROGRESS,
      assignedTo: member._id.toString(),
      dueDate: dateOffset(5),
    });
    await replaceTaskLabelsService(context, matchingTask._id.toString(), [
      label._id.toString(),
    ]);
    await createTask({
      workspaceId: workspace._id.toString(),
      projectId: otherProject._id.toString(),
      userId: user._id.toString(),
      title: "Non matching task",
      status: TaskStatusEnum.TODO,
      assignedTo: user._id.toString(),
      dueDate: dateOffset(5),
    });

    const timeline = await getTimelineService(workspace._id.toString(), {
      range: "30d",
      projectIds: [project._id.toString()],
      assigneeIds: [member._id.toString()],
      labelIds: [label._id.toString()],
      statuses: [TaskStatusEnum.IN_PROGRESS],
    });

    expect(timeline.tasks).toHaveLength(1);
    expect(timeline.tasks[0].title).toBe("Matching task");
  });

  it("validates explicit timeline windows", () => {
    expect(() =>
      timelineQuerySchema.parse({
        startDate: startOfDateInput(0),
      })
    ).toThrow(/Both startDate and endDate/i);
    expect(() =>
      timelineQuerySchema.parse({
        startDate: startOfDateInput(0),
        endDate: startOfDateInput(400),
      })
    ).toThrow(/365 days/i);
  });
});
