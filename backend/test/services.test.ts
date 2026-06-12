import { describe, expect, it } from "vitest";
import AccountModel from "../src/models/account.model";
import MemberModel from "../src/models/member.model";
import ProjectModel from "../src/models/project.model";
import RoleModel from "../src/models/roles-permission.model";
import TaskModel from "../src/models/task.model";
import UserModel from "../src/models/user.model";
import WorkspaceModel from "../src/models/workspace.model";
import { Permissions, Roles } from "../src/enums/role.enum";
import { ProviderEnum } from "../src/enums/account-provider.enum";
import { TaskPriorityEnum, TaskStatusEnum } from "../src/enums/task.enum";
import {
  loginOrCreateAccountService,
  registerUserService,
  verifyUserService,
} from "../src/services/auth.service";
import {
  changeMemberRoleService,
  createWorkspaceService,
  deleteWorkspaceService,
  getAllWorkspacesUserIsMemberService,
  getWorkspaceAnalyticsService,
  getWorkspaceByIdService,
  getWorkspaceMembersService,
  updateWorkspaceByIdService,
} from "../src/services/workspace.service";
import {
  getMemberRoleInWorkspace,
  joinWorkspaceByInviteService,
} from "../src/services/member.service";
import {
  createProjectService,
  deleteProjectService,
  getProjectAnalyticsService,
  getProjectByIdAndWorkspaceIdService,
  getProjectsInWorkspaceService,
  updateProjectService,
} from "../src/services/project.service";
import {
  createTaskService,
  deleteTaskService,
  getAllTasksService,
  getTaskByIdService,
  updateTaskService,
} from "../src/services/task.service";
import { getCurrentUserService } from "../src/services/user.service";
import { roleGuard } from "../src/utils/roleGuard";
import { registerSchema } from "../src/validation/auth.validation";
import { workspaceIdSchema } from "../src/validation/workspace.validation";

const strongPassword = "Str0ng!Pass";

const registerUser = async (email: string, name = "Test User") => {
  const result = await registerUserService({
    email,
    name,
    password: strongPassword,
  });

  const user = await UserModel.findById(result.userId);
  const workspace = await WorkspaceModel.findById(result.workspaceId);

  if (!user || !workspace) {
    throw new Error("Expected registered user and workspace to exist");
  }

  return { user, workspace };
};

const roleByName = async (name: string) => {
  const role = await RoleModel.findOne({ name });

  if (!role) {
    throw new Error(`Expected ${name} role to exist`);
  }

  return role;
};

describe("auth business logic", () => {
  it("registers a user with account, owner membership, and hashed password", async () => {
    const { user, workspace } = await registerUser("owner@example.com", "Owner");

    expect(user.currentWorkspace?.toString()).toBe(workspace._id.toString());
    expect(await AccountModel.countDocuments({ userId: user._id })).toBe(1);
    expect(
      await MemberModel.countDocuments({
        userId: user._id,
        workspaceId: workspace._id,
      })
    ).toBe(1);

    const userWithPassword = await UserModel.findById(user._id).select(
      "+password"
    );
    expect(userWithPassword?.password).toBeTruthy();
    expect(userWithPassword?.password).not.toBe(strongPassword);

    const verifiedUser = await verifyUserService({
      email: "owner@example.com",
      password: strongPassword,
    });
    expect(verifiedUser.email).toBe("owner@example.com");
    expect(verifiedUser).not.toHaveProperty("password");
  });

  it("enforces the registration password policy", () => {
    expect(() =>
      registerSchema.parse({
        name: "Weak Password",
        email: "weak@example.com",
        password: "password",
      })
    ).toThrow(/uppercase|number|special/i);
  });

  it("rejects duplicate registration and invalid credentials", async () => {
    await registerUser("duplicate@example.com");

    await expect(
      registerUser("duplicate@example.com", "Duplicate")
    ).rejects.toThrow(/email already exists/i);

    await expect(
      verifyUserService({
        email: "duplicate@example.com",
        password: "wrong-password",
      })
    ).rejects.toThrow(/invalid email or password/i);

    await expect(
      verifyUserService({
        email: "missing@example.com",
        password: strongPassword,
      })
    ).rejects.toThrow(/invalid email or password/i);
  });

  it("creates a Google account once and reuses the user on repeat login", async () => {
    const firstLogin = await loginOrCreateAccountService({
      provider: ProviderEnum.GOOGLE,
      displayName: "Google User",
      providerId: "google-user-1",
      email: "google@example.com",
      picture: "https://example.com/avatar.png",
    });

    const secondLogin = await loginOrCreateAccountService({
      provider: ProviderEnum.GOOGLE,
      displayName: "Google User",
      providerId: "google-user-1",
      email: "google@example.com",
    });

    expect(firstLogin.user._id.toString()).toBe(secondLogin.user._id.toString());
    expect(await UserModel.countDocuments({ email: "google@example.com" })).toBe(
      1
    );
    expect(await WorkspaceModel.countDocuments({ owner: firstLogin.user._id })).toBe(
      1
    );
  });
});

describe("workspace CRUD and membership integrity", () => {
  it("creates, updates, and deletes a workspace transactionally", async () => {
    const { user, workspace: defaultWorkspace } = await registerUser(
      "workspace-owner@example.com"
    );

    const { workspace } = await createWorkspaceService(user._id.toString(), {
      name: "Internal Beta",
      description: "Launch workspace",
    });

    expect(workspace.name).toBe("Internal Beta");
    expect(
      await MemberModel.exists({
        userId: user._id,
        workspaceId: workspace._id,
      })
    ).toBeTruthy();

    const { workspace: updatedWorkspace } = await updateWorkspaceByIdService(
      workspace._id.toString(),
      "Internal Beta Updated",
      "Updated description"
    );
    expect(updatedWorkspace.name).toBe("Internal Beta Updated");

    const result = await deleteWorkspaceService(
      workspace._id.toString(),
      user._id.toString()
    );
    expect(result.currentWorkspace?.toString()).toBe(
      defaultWorkspace._id.toString()
    );
    expect(await WorkspaceModel.findById(workspace._id)).toBeNull();
    expect(await MemberModel.countDocuments({ workspaceId: workspace._id })).toBe(
      0
    );
  });

  it("prevents duplicate invite joins and owner role escalation", async () => {
    const { user: owner, workspace } = await registerUser("owner2@example.com");
    const { user: invitedUser } = await registerUser("member@example.com");

    await joinWorkspaceByInviteService(
      invitedUser._id.toString(),
      workspace.inviteCode
    );

    await expect(
      joinWorkspaceByInviteService(invitedUser._id.toString(), workspace.inviteCode)
    ).rejects.toThrow(/already a member/i);

    const adminRole = await roleByName(Roles.ADMIN);
    const ownerRole = await roleByName(Roles.OWNER);
    const memberRole = await roleByName(Roles.MEMBER);

    const { member } = await changeMemberRoleService(
      workspace._id.toString(),
      invitedUser._id.toString(),
      adminRole._id.toString()
    );
    expect(member.role._id.toString()).toBe(adminRole._id.toString());

    await expect(
      changeMemberRoleService(
        workspace._id.toString(),
        invitedUser._id.toString(),
        ownerRole._id.toString()
      )
    ).rejects.toThrow(/ownership cannot be assigned/i);

    await expect(
      changeMemberRoleService(
        workspace._id.toString(),
        owner._id.toString(),
        memberRole._id.toString()
      )
    ).rejects.toThrow(/owner role cannot be changed/i);
  });

  it("reads workspace lists, members, roles, analytics, and current user", async () => {
    const { user, workspace } = await registerUser("reader@example.com");
    const { user: memberUser } = await registerUser("reader-member@example.com");

    await joinWorkspaceByInviteService(memberUser._id.toString(), workspace.inviteCode);

    const memberRole = await getMemberRoleInWorkspace(
      memberUser._id.toString(),
      workspace._id.toString()
    );
    expect(memberRole.role).toBe(Roles.MEMBER);

    const workspaces = await getAllWorkspacesUserIsMemberService(
      memberUser._id.toString()
    );
    expect(workspaces.workspaces).toHaveLength(2);

    const workspaceById = await getWorkspaceByIdService(workspace._id.toString());
    expect(workspaceById.workspace.members).toHaveLength(2);

    const members = await getWorkspaceMembersService(workspace._id.toString());
    expect(members.members).toHaveLength(2);
    expect(members.roles.map((role) => role.name)).toEqual(
      expect.arrayContaining([Roles.OWNER, Roles.ADMIN, Roles.MEMBER])
    );

    const { project } = await createProjectService(
      user._id.toString(),
      workspace._id.toString(),
      { name: "Analytics Project" }
    );

    await createTaskService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString(),
      {
        title: "Done task",
        priority: TaskPriorityEnum.MEDIUM,
        status: TaskStatusEnum.DONE,
      }
    );
    await createTaskService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString(),
      {
        title: "Overdue task",
        priority: TaskPriorityEnum.HIGH,
        status: TaskStatusEnum.TODO,
        dueDate: "2020-01-01",
      }
    );

    const analytics = await getWorkspaceAnalyticsService(workspace._id.toString());
    expect(analytics.analytics).toMatchObject({
      totalTasks: 2,
      overdueTasks: 1,
      completedTasks: 1,
    });

    const currentUser = await getCurrentUserService(user._id.toString());
    expect(currentUser.user.email).toBe("reader@example.com");

    await expect(
      getMemberRoleInWorkspace(user._id.toString(), memberUser.currentWorkspace!.toString())
    ).rejects.toThrow(/not a member/i);
  });
});

describe("project and task CRUD", () => {
  it("creates, updates, filters, and deletes tasks inside a project", async () => {
    const { user, workspace } = await registerUser("task-owner@example.com");
    const { project } = await createProjectService(
      user._id.toString(),
      workspace._id.toString(),
      {
        name: "Beta Project",
        description: "Project description",
      }
    );

    const { task } = await createTaskService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString(),
      {
        title: "Ship beta checklist",
        description: "Harden the API",
        priority: TaskPriorityEnum.HIGH,
        status: TaskStatusEnum.TODO,
        assignedTo: user._id.toString(),
        dueDate: "2026-07-01",
      }
    );

    const { updatedTask } = await updateTaskService(
      workspace._id.toString(),
      project._id.toString(),
      task._id.toString(),
      {
        status: TaskStatusEnum.IN_PROGRESS,
      }
    );
    expect(updatedTask.status).toBe(TaskStatusEnum.IN_PROGRESS);

    const fetchedTask = await getTaskByIdService(
      workspace._id.toString(),
      project._id.toString(),
      task._id.toString()
    );
    expect(fetchedTask.title).toBe("Ship beta checklist");

    const filteredTasks = await getAllTasksService(
      workspace._id.toString(),
      {
        projectId: project._id.toString(),
        status: [TaskStatusEnum.IN_PROGRESS],
        keyword: "beta checklist",
      },
      { pageNumber: 1, pageSize: 10 }
    );
    expect(filteredTasks.tasks).toHaveLength(1);
    expect(filteredTasks.pagination.totalCount).toBe(1);

    await deleteTaskService(workspace._id.toString(), task._id.toString());
    expect(await TaskModel.findById(task._id)).toBeNull();
  });

  it("keeps project updates scoped to the workspace and cascades project deletion", async () => {
    const { user, workspace } = await registerUser("project-owner@example.com");
    const { project } = await createProjectService(
      user._id.toString(),
      workspace._id.toString(),
      {
        name: "Original Project",
        description: "Original description",
      }
    );

    const { project: updatedProject } = await updateProjectService(
      workspace._id.toString(),
      project._id.toString(),
      {
        name: "Renamed Project",
        description: "",
      }
    );
    expect(updatedProject.name).toBe("Renamed Project");
    expect(updatedProject.description).toBe("");

    await createTaskService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString(),
      {
        title: "Deleted with project",
        priority: TaskPriorityEnum.MEDIUM,
        status: TaskStatusEnum.TODO,
      }
    );

    await deleteProjectService(workspace._id.toString(), project._id.toString());
    expect(await ProjectModel.findById(project._id)).toBeNull();
    expect(await TaskModel.countDocuments({ project: project._id })).toBe(0);
  });

  it("reads paginated projects and project analytics", async () => {
    const { user, workspace } = await registerUser("project-reader@example.com");
    const { workspace: otherWorkspace } = await registerUser("other-workspace@example.com");

    const firstProject = await createProjectService(
      user._id.toString(),
      workspace._id.toString(),
      { name: "First Project" }
    );
    await createProjectService(user._id.toString(), workspace._id.toString(), {
      name: "Second Project",
    });

    const page = await getProjectsInWorkspaceService(
      workspace._id.toString(),
      1,
      1
    );
    expect(page.totalCount).toBe(2);
    expect(page.totalPages).toBe(2);
    expect(page.projects).toHaveLength(1);

    const projectDetails = await getProjectByIdAndWorkspaceIdService(
      workspace._id.toString(),
      firstProject.project._id.toString()
    );
    expect(projectDetails.project.name).toBe("First Project");

    await createTaskService(
      workspace._id.toString(),
      firstProject.project._id.toString(),
      user._id.toString(),
      {
        title: "Project done task",
        priority: TaskPriorityEnum.LOW,
        status: TaskStatusEnum.DONE,
      }
    );
    await createTaskService(
      workspace._id.toString(),
      firstProject.project._id.toString(),
      user._id.toString(),
      {
        title: "Project overdue task",
        priority: TaskPriorityEnum.HIGH,
        status: TaskStatusEnum.TODO,
        dueDate: "2020-01-01",
      }
    );

    const analytics = await getProjectAnalyticsService(
      workspace._id.toString(),
      firstProject.project._id.toString()
    );
    expect(analytics.analytics).toMatchObject({
      totalTasks: 2,
      overdueTasks: 1,
      completedTasks: 1,
    });

    await expect(
      getProjectByIdAndWorkspaceIdService(
        otherWorkspace._id.toString(),
        firstProject.project._id.toString()
      )
    ).rejects.toThrow(/does not belong/i);
  });

  it("rejects task assignment to users outside the workspace", async () => {
    const { user, workspace } = await registerUser("task-owner2@example.com");
    const { user: outsider } = await registerUser("outsider@example.com");
    const { project } = await createProjectService(
      user._id.toString(),
      workspace._id.toString(),
      { name: "Secure Project" }
    );

    await expect(
      createTaskService(
        workspace._id.toString(),
        project._id.toString(),
        user._id.toString(),
        {
          title: "Should fail",
          priority: TaskPriorityEnum.LOW,
          status: TaskStatusEnum.TODO,
          assignedTo: outsider._id.toString(),
        }
      )
    ).rejects.toThrow(/not a member/i);
  });

  it("rejects invalid task reads, updates, and deletes", async () => {
    const { user, workspace } = await registerUser("task-errors@example.com");
    const { user: outsider } = await registerUser("task-outsider@example.com");
    const { project } = await createProjectService(
      user._id.toString(),
      workspace._id.toString(),
      { name: "Task Errors" }
    );
    const { task } = await createTaskService(
      workspace._id.toString(),
      project._id.toString(),
      user._id.toString(),
      {
        title: "Task to protect",
        priority: TaskPriorityEnum.MEDIUM,
        status: TaskStatusEnum.TODO,
      }
    );

    await expect(
      updateTaskService(
        workspace._id.toString(),
        project._id.toString(),
        task._id.toString(),
        { assignedTo: outsider._id.toString() }
      )
    ).rejects.toThrow(/not a member/i);

    await expect(
      getTaskByIdService(
        outsider.currentWorkspace!.toString(),
        project._id.toString(),
        task._id.toString()
      )
    ).rejects.toThrow(/does not belong/i);

    await expect(
      deleteTaskService(workspace._id.toString(), outsider._id.toString())
    ).rejects.toThrow(/task not found/i);
  });
});

describe("role permissions", () => {
  it("allows owners and rejects members for protected actions", () => {
    expect(() =>
      roleGuard(Roles.OWNER, [Permissions.DELETE_PROJECT])
    ).not.toThrow();

    expect(() =>
      roleGuard(Roles.MEMBER, [Permissions.DELETE_PROJECT])
    ).toThrow(/necessary permissions/i);
  });

  it("does not allow deleting another user's workspace", async () => {
    const { workspace } = await registerUser("workspace-delete-owner@example.com");
    const { user: otherUser } = await registerUser("workspace-attacker@example.com");

    await expect(
      deleteWorkspaceService(workspace._id.toString(), otherUser._id.toString())
    ).rejects.toThrow(/not authorized/i);
  });

  it("requires valid object ids at validation boundaries", () => {
    expect(() => workspaceIdSchema.parse("not-an-id")).toThrow(/ObjectId/i);
  });

  it("returns a clear error for a missing current user", async () => {
    await expect(
      getCurrentUserService("64a000000000000000000000")
    ).rejects.toThrow(/user not found/i);
  });
});
