import { expect, request, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import type { Express } from "express";
import fs from "fs/promises";
import http from "http";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import os from "os";
import path from "path";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.BASE_PATH = "/v1";
process.env.SESSION_SECRET = "test-session-secret-at-least-32-characters";
process.env.SESSION_EXPIRES_IN = "1d";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
process.env.GOOGLE_CALLBACK_URL =
  "https://127.0.0.1/api/v1/auth/google/callback";
process.env.FRONTEND_ORIGIN = "https://127.0.0.1";
process.env.FRONTEND_GOOGLE_CALLBACK_URL = "https://127.0.0.1/login/callback";
process.env.LOCAL_FILE_STORAGE_DIR = path.join(
  os.tmpdir(),
  `teamsync-e2e-uploads-${Date.now()}`
);

let replSet: MongoMemoryReplSet;
let server: http.Server;
let baseURL: string;
let AccountModel: mongoose.Model<any>;
let ActivityModel: mongoose.Model<any>;
let AuditLogModel: mongoose.Model<any>;
let CommentModel: mongoose.Model<any>;
let FileAssetModel: mongoose.Model<any>;
let LabelModel: mongoose.Model<any>;
let MemberModel: mongoose.Model<any>;
let MentionModel: mongoose.Model<any>;
let MilestoneModel: mongoose.Model<any>;
let NotificationModel: mongoose.Model<any>;
let NotificationPreferenceModel: mongoose.Model<any>;
let ProjectModel: mongoose.Model<any>;
let RoleModel: mongoose.Model<any>;
let TaskDependencyModel: mongoose.Model<any>;
let TaskModel: mongoose.Model<any>;
let TaskWatcherModel: mongoose.Model<any>;
let UserModel: mongoose.Model<any>;
let WorkspaceModel: mongoose.Model<any>;
let RolePermissions: Record<string, string[]>;

const userCounter = { value: 0 };
const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const pdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");

const nextUser = (prefix: string) => {
  userCounter.value += 1;
  return {
    name: `${prefix} User`,
    email: `${prefix.toLowerCase()}-${Date.now()}-${userCounter.value}@example.com`,
    password: "Str0ng!Password",
  };
};

const dateInput = (daysFromNow: number) => {
  const next = new Date();
  next.setDate(next.getDate() + daysFromNow);
  return next.toISOString().slice(0, 10);
};

const getCsrfHeaders = async (context: APIRequestContext) => {
  const storage = await context.storageState();
  const token = storage.cookies.find((cookie) => cookie.name === "XSRF-TOKEN");

  expect(token?.value).toBeTruthy();
  return { "X-CSRF-Token": token?.value ?? "" };
};

const commentPayload = (text: string) => ({
  plainText: text,
  bodyJson: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  },
});

const mentionCommentPayload = (text: string, mentionedUserId: string) => ({
  plainText: text,
  bodyJson: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text },
          {
            type: "mention",
            attrs: {
              id: mentionedUserId,
              label: "Mentioned User",
            },
          },
        ],
      },
    ],
  },
});

const registerAndLogin = async (context: APIRequestContext, prefix: string) => {
  const user = nextUser(prefix);

  const registerResponse = await context.post("/v1/auth/register", {
    data: user,
  });
  expect(registerResponse.status()).toBe(201);

  const loginResponse = await context.post("/v1/auth/login", {
    data: {
      email: user.email,
      password: user.password,
    },
  });
  expect(loginResponse.status()).toBe(200);

  const currentResponse = await context.get("/v1/user/current");
  expect(currentResponse.status()).toBe(200);

  const currentBody = await currentResponse.json();
  const currentWorkspace =
    currentBody.user.currentWorkspace?._id ?? currentBody.user.currentWorkspace;

  expect(currentBody.user._id).toBeTruthy();
  expect(currentWorkspace).toBeTruthy();

  return {
    user,
    userId: currentBody.user._id as string,
    currentWorkspace: currentWorkspace as string,
  };
};

const seedRoles = async () => {
  await RoleModel.insertMany(
    Object.entries(RolePermissions).map(([name, permissions]) => ({
      name,
      permissions,
    }))
  );
};

const loadDefault = async <T>(path: string): Promise<T> => {
  const importedModule = (await import(path)) as {
    default?: T | { default?: T };
  };
  const defaultExport = importedModule.default;

  if (
    defaultExport &&
    typeof defaultExport === "object" &&
    "default" in defaultExport
  ) {
    return defaultExport.default as T;
  }

  return defaultExport as T;
};

test.beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  await mongoose.connect(replSet.getUri(), {
    dbName: "teamsync-e2e",
  });

  AccountModel = await loadDefault("../dist/models/account.model.js");
  ActivityModel = await loadDefault("../dist/models/activity.model.js");
  AuditLogModel = await loadDefault("../dist/models/audit-log.model.js");
  CommentModel = await loadDefault("../dist/models/comment.model.js");
  FileAssetModel = await loadDefault("../dist/models/file-asset.model.js");
  LabelModel = await loadDefault("../dist/models/label.model.js");
  MemberModel = await loadDefault("../dist/models/member.model.js");
  MentionModel = await loadDefault("../dist/models/mention.model.js");
  MilestoneModel = await loadDefault("../dist/models/milestone.model.js");
  NotificationModel = await loadDefault("../dist/models/notification.model.js");
  NotificationPreferenceModel = await loadDefault(
    "../dist/models/notification-preference.model.js"
  );
  ProjectModel = await loadDefault("../dist/models/project.model.js");
  RoleModel = await loadDefault("../dist/models/roles-permission.model.js");
  TaskDependencyModel = await loadDefault(
    "../dist/models/task-dependency.model.js"
  );
  TaskModel = await loadDefault("../dist/models/task.model.js");
  TaskWatcherModel = await loadDefault("../dist/models/task-watcher.model.js");
  UserModel = await loadDefault("../dist/models/user.model.js");
  WorkspaceModel = await loadDefault("../dist/models/workspace.model.js");
  RolePermissions = (
    await import("../dist/utils/role-permission.js")
  ).RolePermissions;

  await Promise.all([
    AccountModel.init(),
    ActivityModel.init(),
    AuditLogModel.init(),
    CommentModel.init(),
    FileAssetModel.init(),
    LabelModel.init(),
    MemberModel.init(),
    MentionModel.init(),
    MilestoneModel.init(),
    NotificationModel.init(),
    NotificationPreferenceModel.init(),
    ProjectModel.init(),
    RoleModel.init(),
    TaskDependencyModel.init(),
    TaskModel.init(),
    TaskWatcherModel.init(),
    UserModel.init(),
    WorkspaceModel.init(),
  ]);

  await seedRoles();

  const app = await loadDefault<Express>("../dist/app.js");
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Playwright E2E server did not start on a TCP port");
  }

  baseURL = `http://127.0.0.1:${address.port}`;
});

test.beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({})
    )
  );
  await seedRoles();
  await fs.rm(process.env.LOCAL_FILE_STORAGE_DIR!, {
    recursive: true,
    force: true,
  });
});

test.afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
  }
  await fs.rm(process.env.LOCAL_FILE_STORAGE_DIR!, {
    recursive: true,
    force: true,
  });
});

test("session auth, CSRF, workspace, project, task, invite, and role gates work", async () => {
  const ownerContext = await request.newContext({ baseURL });
  const memberContext = await request.newContext({ baseURL });

  const owner = await registerAndLogin(ownerContext, "Owner");
  const ownerCsrf = await getCsrfHeaders(ownerContext);

  const accountResponse = await ownerContext.get("/v1/user/account");
  expect(accountResponse.status()).toBe(200);
  const accountBody = await accountResponse.json();
  expect(accountBody.providers).toEqual(["EMAIL"]);
  expect(accountBody.hasPassword).toBe(true);
  expect(JSON.stringify(accountBody)).not.toContain(owner.user.email);

  const rejectedProfileUpdate = await ownerContext.put("/v1/user/profile", {
    data: {
      name: "No CSRF Profile",
      bio: "",
      timezone: "Asia/Kolkata",
    },
  });
  expect(rejectedProfileUpdate.status()).toBe(403);

  const invalidTimezoneResponse = await ownerContext.put("/v1/user/profile", {
    headers: ownerCsrf,
    data: {
      name: "Invalid Timezone",
      bio: "",
      timezone: "UTC+5:30",
    },
  });
  expect(invalidTimezoneResponse.status()).toBe(400);

  const profileResponse = await ownerContext.put("/v1/user/profile", {
    headers: ownerCsrf,
    data: {
      name: "Updated Owner",
      bio: "Internal beta profile",
      timezone: "Asia/Kolkata",
    },
  });
  expect(profileResponse.status()).toBe(200);
  const profileBody = await profileResponse.json();
  expect(profileBody.user).toMatchObject({
    name: "Updated Owner",
    bio: "Internal beta profile",
    timezone: "Asia/Kolkata",
  });
  expect(profileBody.user.preferences).toEqual({});

  const changedEmail = `owner-updated-${Date.now()}@example.com`;
  const emailResponse = await ownerContext.put("/v1/user/email", {
    headers: ownerCsrf,
    data: {
      email: changedEmail,
      currentPassword: owner.user.password,
    },
  });
  expect(emailResponse.status()).toBe(200);
  const emailBody = await emailResponse.json();
  expect(emailBody.user.email).toBe(changedEmail);

  const currentAfterEmailResponse = await ownerContext.get("/v1/user/current");
  expect(currentAfterEmailResponse.status()).toBe(200);
  const currentAfterEmailBody = await currentAfterEmailResponse.json();
  expect(currentAfterEmailBody.user.email).toBe(changedEmail);

  const emailAccount = await AccountModel.findOne({
    userId: owner.userId,
    provider: "EMAIL",
  }).lean();
  expect(emailAccount?.providerId).toBe(changedEmail);

  const passwordResponse = await ownerContext.put("/v1/user/password", {
    headers: ownerCsrf,
    data: {
      currentPassword: owner.user.password,
      newPassword: "Str0nger!Password2",
    },
  });
  expect(passwordResponse.status()).toBe(200);

  const rejectedWorkspaceCreate = await ownerContext.post(
    "/v1/workspace/create/new",
    {
      data: { name: "No CSRF Workspace" },
    }
  );
  expect(rejectedWorkspaceCreate.status()).toBe(403);

  const workspaceResponse = await ownerContext.get(
    `/v1/workspace/${owner.currentWorkspace}`
  );
  expect(workspaceResponse.status()).toBe(200);
  const workspaceBody = await workspaceResponse.json();
  const inviteCode = workspaceBody.workspace.inviteCode as string;
  expect(inviteCode).toBeTruthy();

  const projectResponse = await ownerContext.post(
    `/v1/project/workspace/${owner.currentWorkspace}/create`,
    {
      headers: ownerCsrf,
      data: {
        name: "Beta Project",
        description: "Certification project flow",
      },
    }
  );
  expect(projectResponse.status()).toBe(201);
  const projectBody = await projectResponse.json();
  const projectId = projectBody.project._id as string;

  const taskResponse = await ownerContext.post(
    `/v1/task/project/${projectId}/workspace/${owner.currentWorkspace}/create`,
    {
      headers: ownerCsrf,
      data: {
        title: "Beta Task",
        description: "Certification task flow",
        priority: "HIGH",
        status: "TODO",
      },
    }
  );
  expect(taskResponse.status()).toBe(201);
  const taskBody = await taskResponse.json();
  const taskId = taskBody.task._id as string;

  const activeTimerInitialResponse = await ownerContext.get(
    `/v1/time/workspace/${owner.currentWorkspace}/active`
  );
  expect(activeTimerInitialResponse.status()).toBe(200);
  expect((await activeTimerInitialResponse.json()).activeTimer).toBeNull();

  const startTimerResponse = await ownerContext.post(
    `/v1/time/workspace/${owner.currentWorkspace}/timer/start`,
    {
      headers: ownerCsrf,
      data: {
        taskId,
        note: "E2E task timer",
      },
    }
  );
  expect(startTimerResponse.status()).toBe(201);
  const startTimerBody = await startTimerResponse.json();
  expect(startTimerBody.activeTimer.task).toBe(taskId);
  expect(startTimerBody.activeTimer.taskTitle).toBe("Beta Task");

  const duplicateTimerResponse = await ownerContext.post(
    `/v1/time/workspace/${owner.currentWorkspace}/timer/start`,
    {
      headers: ownerCsrf,
      data: {
        projectId,
      },
    }
  );
  expect(duplicateTimerResponse.status()).toBe(409);
  const duplicateTimerBody = await duplicateTimerResponse.json();
  expect(duplicateTimerBody.startedAt).toBeTruthy();
  expect(duplicateTimerBody.taskId).toBe(taskId);

  const stopTimerResponse = await ownerContext.post(
    `/v1/time/workspace/${owner.currentWorkspace}/timer/stop`,
    {
      headers: ownerCsrf,
    }
  );
  expect(stopTimerResponse.status()).toBe(200);
  const stopTimerBody = await stopTimerResponse.json();
  expect(stopTimerBody.timeEntry.endedAt).toBeTruthy();

  const manualEntryResponse = await ownerContext.post(
    `/v1/time/workspace/${owner.currentWorkspace}/entries`,
    {
      headers: ownerCsrf,
      data: {
        projectId,
        startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        note: "E2E manual time",
      },
    }
  );
  expect(manualEntryResponse.status()).toBe(201);

  const ownerEntriesResponse = await ownerContext.get(
    `/v1/time/workspace/${owner.currentWorkspace}/entries?pageSize=20`
  );
  expect(ownerEntriesResponse.status()).toBe(200);
  const ownerEntriesBody = await ownerEntriesResponse.json();
  expect(ownerEntriesBody.timeEntries.length).toBeGreaterThanOrEqual(2);

  const ownerTimesheetResponse = await ownerContext.get(
    `/v1/time/workspace/${owner.currentWorkspace}/timesheet`
  );
  expect(ownerTimesheetResponse.status()).toBe(200);
  const ownerTimesheetBody = await ownerTimesheetResponse.json();
  expect(ownerTimesheetBody.timesheet.totalSeconds).toBeGreaterThan(0);

  const ownerProductivityMembersResponse = await ownerContext.get(
    `/v1/workspace/members/${owner.currentWorkspace}`
  );
  expect(ownerProductivityMembersResponse.status()).toBe(200);
  const ownerProductivityMembersBody =
    await ownerProductivityMembersResponse.json();
  const ownerMember = ownerProductivityMembersBody.members.find(
    (member: { userId: { _id: string } }) => member.userId._id === owner.userId
  );
  expect(ownerMember?._id).toBeTruthy();

  const updateCapacityResponse = await ownerContext.patch(
    `/v1/time/workspace/${owner.currentWorkspace}/capacity/${ownerMember._id}`,
    {
      headers: ownerCsrf,
      data: {
        capacityHoursPerWeek: 35,
      },
    }
  );
  expect(updateCapacityResponse.status()).toBe(200);

  const capacityResponse = await ownerContext.get(
    `/v1/time/workspace/${owner.currentWorkspace}/capacity?range=7d`
  );
  expect(capacityResponse.status()).toBe(200);
  const capacityBody = await capacityResponse.json();
  const ownerCapacity = capacityBody.capacity.members.find(
    (member: { userId: string }) => member.userId === owner.userId
  );
  expect(ownerCapacity.capacitySeconds).toBe(35 * 3600);
  expect(ownerCapacity.trackedSeconds).toBeGreaterThan(0);

  const workloadResponse = await ownerContext.get(
    `/v1/time/workspace/${owner.currentWorkspace}/workload?range=7d`
  );
  expect(workloadResponse.status()).toBe(200);

  const predecessorResponse = await ownerContext.post(
    `/v1/task/project/${projectId}/workspace/${owner.currentWorkspace}/create`,
    {
      headers: ownerCsrf,
      data: {
        title: "Predecessor Task",
        description: "Dependency source",
        priority: "MEDIUM",
        status: "TODO",
      },
    }
  );
  expect(predecessorResponse.status()).toBe(201);
  const predecessorBody = await predecessorResponse.json();
  const predecessorTaskId = predecessorBody.task._id as string;

  const timelineTaskResponse = await ownerContext.post(
    `/v1/task/project/${projectId}/workspace/${owner.currentWorkspace}/create`,
    {
      headers: ownerCsrf,
      data: {
        title: "Timeline Visible Task",
        description: "Planning timeline task",
        priority: "MEDIUM",
        status: "TODO",
        dueDate: dateInput(20),
      },
    }
  );
  expect(timelineTaskResponse.status()).toBe(201);
  const timelineTaskBody = await timelineTaskResponse.json();
  const timelineTaskId = timelineTaskBody.task._id as string;

  const labelResponse = await ownerContext.post(
    `/v1/label/workspace/${owner.currentWorkspace}`,
    {
      headers: ownerCsrf,
      data: {
        name: "Beta Label",
        color: "#2563eb",
      },
    }
  );
  expect(labelResponse.status()).toBe(201);
  const labelBody = await labelResponse.json();
  const labelId = labelBody.label._id as string;

  const attachLabelsResponse = await ownerContext.put(
    `/v1/task/${taskId}/workspace/${owner.currentWorkspace}/labels`,
    {
      headers: ownerCsrf,
      data: {
        labelIds: [labelId],
      },
    }
  );
  expect(attachLabelsResponse.status()).toBe(200);

  const deleteLabelResponse = await ownerContext.delete(
    `/v1/label/workspace/${owner.currentWorkspace}/${labelId}`,
    {
      headers: ownerCsrf,
    }
  );
  expect(deleteLabelResponse.status()).toBe(200);
  const retainedLabelTask = await TaskModel.findById(taskId).select("labels");
  expect(retainedLabelTask?.labels.map((id: mongoose.Types.ObjectId) => id.toString())).toContain(labelId);

  const taskAfterDeletedLabelResponse = await ownerContext.get(
    `/v1/task/${taskId}/project/${projectId}/workspace/${owner.currentWorkspace}`
  );
  expect(taskAfterDeletedLabelResponse.status()).toBe(200);
  const taskAfterDeletedLabelBody = await taskAfterDeletedLabelResponse.json();
  expect(taskAfterDeletedLabelBody.task.labels).toHaveLength(0);

  const subtaskResponse = await ownerContext.post(
    `/v1/task/${taskId}/workspace/${owner.currentWorkspace}/subtasks`,
    {
      headers: ownerCsrf,
      data: {
        title: "Beta Subtask",
      },
    }
  );
  expect(subtaskResponse.status()).toBe(201);
  const subtaskBody = await subtaskResponse.json();
  expect(subtaskBody.subtask.parentTask).toBe(taskId);

  const checklistResponse = await ownerContext.post(
    `/v1/task/${taskId}/workspace/${owner.currentWorkspace}/checklist`,
    {
      headers: ownerCsrf,
      data: {
        text: "Confirm advanced tasks",
      },
    }
  );
  expect(checklistResponse.status()).toBe(201);
  const checklistBody = await checklistResponse.json();
  const checklistItemId = checklistBody.checklist[0]._id as string;

  const toggleChecklistResponse = await ownerContext.put(
    `/v1/task/${taskId}/workspace/${owner.currentWorkspace}/checklist/${checklistItemId}`,
    {
      headers: ownerCsrf,
      data: {
        completed: true,
      },
    }
  );
  expect(toggleChecklistResponse.status()).toBe(200);

  const dependencyResponse = await ownerContext.post(
    `/v1/task/${taskId}/workspace/${owner.currentWorkspace}/dependencies`,
    {
      headers: ownerCsrf,
      data: {
        predecessorTaskId,
      },
    }
  );
  expect(dependencyResponse.status()).toBe(201);
  const dependencyBody = await dependencyResponse.json();
  const dependencyId = dependencyBody.dependency._id as string;

  const dependencyListResponse = await ownerContext.get(
    `/v1/task/${taskId}/workspace/${owner.currentWorkspace}/dependencies`
  );
  expect(dependencyListResponse.status()).toBe(200);
  const dependencyListBody = await dependencyListResponse.json();
  expect(dependencyListBody.dependencySummary).toMatchObject({
    blockedByCount: 1,
    isBlocked: true,
  });

  const kanbanFullResponse = await ownerContext.get(
    `/v1/task/workspace/${owner.currentWorkspace}/kanban?projectId=${projectId}&columnLimit=10`
  );
  expect(kanbanFullResponse.status()).toBe(200);
  const kanbanFullBody = await kanbanFullResponse.json();
  expect(kanbanFullBody.columns).toHaveLength(5);
  expect(kanbanFullBody.columnCounts.TODO).toBeGreaterThanOrEqual(2);
  const todoColumn = kanbanFullBody.columns.find(
    (column: { status: string }) => column.status === "TODO"
  );
  expect(todoColumn).toBeTruthy();
  const blockedKanbanTask = todoColumn?.tasks.find(
    (task: { _id: string }) => task._id === taskId
  );
  expect(blockedKanbanTask).toMatchObject({
    isBlocked: true,
    blockedByCount: 1,
  });

  const kanbanFirstPageResponse = await ownerContext.get(
    `/v1/task/workspace/${owner.currentWorkspace}/kanban?projectId=${projectId}&status=TODO&columnLimit=1`
  );
  expect(kanbanFirstPageResponse.status()).toBe(200);
  const kanbanFirstPageBody = await kanbanFirstPageResponse.json();
  expect(kanbanFirstPageBody.columns).toHaveLength(1);
  expect(kanbanFirstPageBody.columns[0]).toMatchObject({
    status: "TODO",
    totalCount: expect.any(Number),
    hasMore: true,
    nextCursor: expect.any(String),
  });

  const kanbanNextCursor = encodeURIComponent(
    kanbanFirstPageBody.columns[0].nextCursor
  );
  const kanbanSecondPageResponse = await ownerContext.get(
    `/v1/task/workspace/${owner.currentWorkspace}/kanban?projectId=${projectId}&status=TODO&cursor=${kanbanNextCursor}&columnLimit=1`
  );
  expect(kanbanSecondPageResponse.status()).toBe(200);
  const kanbanSecondPageBody = await kanbanSecondPageResponse.json();
  expect(kanbanSecondPageBody.columns[0].tasks).toHaveLength(1);
  expect(kanbanSecondPageBody.columns[0].tasks[0]._id).not.toBe(
    kanbanFirstPageBody.columns[0].tasks[0]._id
  );

  const recurrenceResponse = await ownerContext.put(
    `/v1/task/${taskId}/workspace/${owner.currentWorkspace}/recurrence`,
    {
      headers: ownerCsrf,
      data: {
        enabled: true,
        frequency: "WEEKLY",
        interval: 1,
        maxOccurrences: 2,
      },
    }
  );
  expect(recurrenceResponse.status()).toBe(200);

  const completeRecurringResponse = await ownerContext.put(
    `/v1/task/${taskId}/project/${projectId}/workspace/${owner.currentWorkspace}/update`,
    {
      headers: ownerCsrf,
      data: {
        status: "DONE",
      },
    }
  );
  expect(completeRecurringResponse.status()).toBe(200);

  const completedTaskRecord = await TaskModel.findById(taskId)
    .select("status completedAt")
    .lean();
  expect(completedTaskRecord?.status).toBe("DONE");
  expect(completedTaskRecord?.completedAt).toBeTruthy();

  const generatedTask = await TaskModel.findOne({
    generatedFromTaskId: taskId,
    workspace: owner.currentWorkspace,
  }).lean();
  expect(generatedTask?.status).toBe("TODO");
  expect(generatedTask?.checklist).toHaveLength(0);

  const ownerPersonalDashboardResponse = await ownerContext.get(
    `/v1/dashboard/workspace/${owner.currentWorkspace}/personal?range=7d`
  );
  expect(ownerPersonalDashboardResponse.status()).toBe(200);
  const ownerPersonalDashboardBody = await ownerPersonalDashboardResponse.json();
  expect(ownerPersonalDashboardBody.dashboard.summary.assignedOpenTasks).toBe(0);

  const ownerTeamDashboardResponse = await ownerContext.get(
    `/v1/dashboard/workspace/${owner.currentWorkspace}/team?range=7d`
  );
  expect(ownerTeamDashboardResponse.status()).toBe(200);
  const ownerTeamDashboardBody = await ownerTeamDashboardResponse.json();
  expect(ownerTeamDashboardBody.dashboard.summary.completedTasks).toBeGreaterThanOrEqual(1);

  const ownerExecutiveDashboardResponse = await ownerContext.get(
    `/v1/dashboard/workspace/${owner.currentWorkspace}/executive?range=7d`
  );
  expect(ownerExecutiveDashboardResponse.status()).toBe(200);
  const ownerExecutiveDashboardBody = await ownerExecutiveDashboardResponse.json();
  expect(
    ownerExecutiveDashboardBody.dashboard.velocity.completedInRange
  ).toBeGreaterThanOrEqual(1);
  expect(
    ownerExecutiveDashboardBody.dashboard.projectHealth.some(
      (project: { projectId: string; health: { status: string } }) =>
        project.projectId === projectId &&
        ["HEALTHY", "AT_RISK", "CRITICAL"].includes(project.health.status)
    )
  ).toBe(true);

  const milestoneResponse = await ownerContext.post(
    `/v1/milestone/workspace/${owner.currentWorkspace}`,
    {
      headers: ownerCsrf,
      data: {
        project: projectId,
        name: "Beta Roadmap Milestone",
        description: "Timeline certification milestone",
        status: "PLANNED",
        startDate: dateInput(3),
        dueDate: dateInput(9),
      },
    }
  );
  expect(milestoneResponse.status()).toBe(201);
  const milestoneBody = await milestoneResponse.json();
  const milestoneId = milestoneBody.milestone._id as string;

  const milestoneListResponse = await ownerContext.get(
    `/v1/milestone/workspace/${owner.currentWorkspace}`
  );
  expect(milestoneListResponse.status()).toBe(200);
  const milestoneListBody = await milestoneListResponse.json();
  expect(
    milestoneListBody.milestones.some(
      (milestone: { _id: string; name: string }) =>
        milestone._id === milestoneId &&
        milestone.name === "Beta Roadmap Milestone"
    )
  ).toBe(true);

  const milestoneUpdateResponse = await ownerContext.put(
    `/v1/milestone/workspace/${owner.currentWorkspace}/${milestoneId}`,
    {
      headers: ownerCsrf,
      data: {
        status: "IN_PROGRESS",
      },
    }
  );
  expect(milestoneUpdateResponse.status()).toBe(200);
  const milestoneUpdateBody = await milestoneUpdateResponse.json();
  expect(milestoneUpdateBody.milestone.status).toBe("IN_PROGRESS");

  const timelineStart = dateInput(2);
  const timelineEnd = dateInput(10);
  const timelineResponse = await ownerContext.get(
    `/v1/timeline/workspace/${owner.currentWorkspace}?startDate=${timelineStart}&endDate=${timelineEnd}&projectIds=${projectId}`
  );
  expect(timelineResponse.status()).toBe(200);
  const timelineBody = await timelineResponse.json();
  const timelineTask = timelineBody.timeline.tasks.find(
    (task: { _id: string }) => task._id === timelineTaskId
  );
  expect(timelineTask).toBeTruthy();
  expect(timelineTask.barStart).toBe(timelineBody.timeline.range.startDate);
  expect(timelineTask.barEnd).toBe(timelineBody.timeline.range.endDate);
  expect(
    timelineBody.timeline.milestones.some(
      (milestone: { _id: string }) => milestone._id === milestoneId
    )
  ).toBe(true);

  const ganttResponse = await ownerContext.get(
    `/v1/gantt/workspace/${owner.currentWorkspace}?startDate=${timelineStart}&endDate=${timelineEnd}&projectIds=${projectId}`
  );
  expect(ganttResponse.status()).toBe(200);
  const ganttBody = await ganttResponse.json();
  expect(
    ganttBody.gantt.tasks.some(
      (task: { _id: string; startDate: string; endDate: string }) =>
        task._id === timelineTaskId && task.startDate && task.endDate
    )
  ).toBe(true);

  const scheduleStart = dateInput(4);
  const scheduleEnd = dateInput(8);
  const scheduleResponse = await ownerContext.put(
    `/v1/task/${timelineTaskId}/workspace/${owner.currentWorkspace}/schedule`,
    {
      headers: ownerCsrf,
      data: {
        startDate: scheduleStart,
        endDate: scheduleEnd,
      },
    }
  );
  expect(scheduleResponse.status()).toBe(200);
  const scheduledTask = await TaskModel.findById(timelineTaskId)
    .select("startDate endDate dueDate")
    .lean();
  expect(scheduledTask?.startDate?.toISOString().slice(0, 10)).toBe(
    scheduleStart
  );
  expect(scheduledTask?.endDate?.toISOString().slice(0, 10)).toBe(scheduleEnd);
  expect(scheduledTask?.dueDate?.toISOString().slice(0, 10)).toBe(scheduleEnd);

  const removeDependencyResponse = await ownerContext.delete(
    `/v1/task/workspace/${owner.currentWorkspace}/dependencies/${dependencyId}`,
    {
      headers: ownerCsrf,
    }
  );
  expect(removeDependencyResponse.status()).toBe(200);

  const taskFileResponse = await ownerContext.post(
    `/v1/file/workspace/${owner.currentWorkspace}/target/TASK/${taskId}`,
    {
      headers: ownerCsrf,
      multipart: {
        file: {
          name: "task-image.png",
          mimeType: "image/png",
          buffer: pngBuffer,
        },
      },
    }
  );
  expect(taskFileResponse.status()).toBe(201);
  const taskFileBody = await taskFileResponse.json();
  const taskFileId = taskFileBody.file._id as string;

  const invalidFileResponse = await ownerContext.post(
    `/v1/file/workspace/${owner.currentWorkspace}/target/TASK/${taskId}`,
    {
      headers: ownerCsrf,
      multipart: {
        file: {
          name: "fake.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("not a pdf"),
        },
      },
    }
  );
  expect(invalidFileResponse.status()).toBe(400);

  const taskFilesResponse = await ownerContext.get(
    `/v1/file/workspace/${owner.currentWorkspace}/target/TASK/${taskId}`
  );
  expect(taskFilesResponse.status()).toBe(200);
  const taskFilesBody = await taskFilesResponse.json();
  expect(taskFilesBody.files).toHaveLength(1);

  const previewResponse = await ownerContext.get(
    `/v1/file/workspace/${owner.currentWorkspace}/${taskFileId}/preview`
  );
  expect(previewResponse.status()).toBe(200);
  expect(previewResponse.headers()["content-type"]).toContain("image/png");

  const downloadResponse = await ownerContext.get(
    `/v1/file/workspace/${owner.currentWorkspace}/${taskFileId}/download`
  );
  expect(downloadResponse.status()).toBe(200);
  expect(downloadResponse.headers()["content-disposition"]).toContain(
    "attachment"
  );

  const projectFileResponse = await ownerContext.post(
    `/v1/file/workspace/${owner.currentWorkspace}/target/PROJECT/${projectId}`,
    {
      headers: ownerCsrf,
      multipart: {
        file: {
          name: "brief.pdf",
          mimeType: "application/pdf",
          buffer: pdfBuffer,
        },
      },
    }
  );
  expect(projectFileResponse.status()).toBe(201);

  const avatarResponse = await ownerContext.post(
    `/v1/file/workspace/${owner.currentWorkspace}/avatar`,
    {
      headers: ownerCsrf,
      multipart: {
        file: {
          name: "avatar.png",
          mimeType: "image/png",
          buffer: pngBuffer,
        },
      },
    }
  );
  expect(avatarResponse.status()).toBe(201);

  const avatarCurrentResponse = await ownerContext.get("/v1/user/current");
  expect(avatarCurrentResponse.status()).toBe(200);
  const avatarCurrentBody = await avatarCurrentResponse.json();
  expect(avatarCurrentBody.user.profilePicture).toContain("/file/workspace/");

  const commentResponse = await ownerContext.post(
    `/v1/comment/workspace/${owner.currentWorkspace}/target/TASK/${taskId}`,
    {
      headers: ownerCsrf,
      data: commentPayload("Owner task comment"),
    }
  );
  expect(commentResponse.status()).toBe(201);
  const commentBody = await commentResponse.json();
  const commentId = commentBody.comment._id as string;

  const commentListResponse = await ownerContext.get(
    `/v1/comment/workspace/${owner.currentWorkspace}/target/TASK/${taskId}`
  );
  expect(commentListResponse.status()).toBe(200);
  const commentListBody = await commentListResponse.json();
  expect(commentListBody.comments).toHaveLength(1);

  const searchPreviewResponse = await ownerContext.get(
    `/v1/search/workspace/${owner.currentWorkspace}?q=Beta&limitPerType=5`
  );
  expect(searchPreviewResponse.status()).toBe(200);
  const searchPreviewBody = await searchPreviewResponse.json();
  const searchGroups = searchPreviewBody.groups as Array<{
    type: string;
    totalCount: number;
    results: Array<{
      type: string;
      title: string;
      snippet: string;
      canView: boolean;
      url: string;
    }>;
  }>;
  expect(searchGroups.map((group) => group.type)).toEqual([
    "PROJECT",
    "TASK",
    "COMMENT",
    "MEMBER",
  ]);
  expect(
    searchGroups
      .find((group) => group.type === "PROJECT")
      ?.results.some((result) => result.title === "Beta Project")
  ).toBe(true);
  expect(
    searchGroups
      .find((group) => group.type === "TASK")
      ?.results.some((result) => result.title === "Beta Task")
  ).toBe(true);
  const commentSearchResponse = await ownerContext.get(
    `/v1/search/workspace/${owner.currentWorkspace}?q=Owner&types=COMMENT`
  );
  expect(commentSearchResponse.status()).toBe(200);
  const commentSearchBody = await commentSearchResponse.json();
  const searchCommentResult = commentSearchBody.groups[0].results.find(
    (result: { snippet: string }) => result.snippet.includes("Owner task comment")
  );
  expect(searchCommentResult?.canView).toBe(true);
  expect(searchCommentResult?.snippet.length).toBeLessThanOrEqual(150);

  const prefixSearchResponse = await ownerContext.get(
    `/v1/search/workspace/${owner.currentWorkspace}?q=Bet&types=PROJECT`
  );
  expect(prefixSearchResponse.status()).toBe(200);

  const pagedProjectSearchResponse = await ownerContext.get(
    `/v1/search/workspace/${owner.currentWorkspace}/type/PROJECT?q=Bet&pageNumber=1&pageSize=1`
  );
  expect(pagedProjectSearchResponse.status()).toBe(200);
  const pagedProjectSearchBody = await pagedProjectSearchResponse.json();
  expect(pagedProjectSearchBody.pagination.totalCount).toBeGreaterThanOrEqual(1);
  expect(pagedProjectSearchBody.results[0]).toMatchObject({
    type: "PROJECT",
    canView: true,
  });

  const updateTaskResponse = await ownerContext.put(
    `/v1/task/${taskId}/project/${projectId}/workspace/${owner.currentWorkspace}/update`,
    {
      headers: ownerCsrf,
      data: {
        status: "IN_PROGRESS",
      },
    }
  );
  expect(updateTaskResponse.status()).toBe(200);

  const kanbanMovedResponse = await ownerContext.get(
    `/v1/task/workspace/${owner.currentWorkspace}/kanban?projectId=${projectId}&status=IN_PROGRESS&columnLimit=10`
  );
  expect(kanbanMovedResponse.status()).toBe(200);
  const kanbanMovedBody = await kanbanMovedResponse.json();
  expect(
    kanbanMovedBody.columns[0].tasks.some(
      (task: { _id: string; status: string }) =>
        task._id === taskId && task.status === "IN_PROGRESS"
    )
  ).toBe(true);

  const member = await registerAndLogin(memberContext, "Member");
  const memberCsrf = await getCsrfHeaders(memberContext);

  const crossWorkspaceResponse = await ownerContext.get(
    `/v1/project/workspace/${member.currentWorkspace}/all`
  );
  expect(crossWorkspaceResponse.status()).toBe(401);

  const crossWorkspaceKanbanResponse = await ownerContext.get(
    `/v1/task/workspace/${member.currentWorkspace}/kanban`
  );
  expect(crossWorkspaceKanbanResponse.status()).toBe(401);

  const crossWorkspaceSearchResponse = await ownerContext.get(
    `/v1/search/workspace/${member.currentWorkspace}?q=Member`
  );
  expect(crossWorkspaceSearchResponse.status()).toBe(401);

  const joinResponse = await memberContext.post(
    `/v1/member/workspace/${inviteCode}/join`,
    {
      headers: memberCsrf,
    }
  );
  expect(joinResponse.status()).toBe(200);

  const memberTimerResponse = await memberContext.post(
    `/v1/time/workspace/${owner.currentWorkspace}/timer/start`,
    {
      headers: memberCsrf,
      data: {
        taskId,
      },
    }
  );
  expect(memberTimerResponse.status()).toBe(201);

  const memberActiveTimerResponse = await memberContext.get(
    `/v1/time/workspace/${owner.currentWorkspace}/active`
  );
  expect(memberActiveTimerResponse.status()).toBe(200);
  const memberActiveTimerBody = await memberActiveTimerResponse.json();
  expect(memberActiveTimerBody.activeTimer.task).toBe(taskId);

  const memberStopTimerResponse = await memberContext.post(
    `/v1/time/workspace/${owner.currentWorkspace}/timer/stop`,
    {
      headers: memberCsrf,
    }
  );
  expect(memberStopTimerResponse.status()).toBe(200);

  const memberOwnTimesheetResponse = await memberContext.get(
    `/v1/time/workspace/${owner.currentWorkspace}/timesheet`
  );
  expect(memberOwnTimesheetResponse.status()).toBe(200);

  const memberBlockedOwnerTimesheetResponse = await memberContext.get(
    `/v1/time/workspace/${owner.currentWorkspace}/timesheet?userId=${owner.userId}`
  );
  expect(memberBlockedOwnerTimesheetResponse.status()).toBe(403);

  const memberBlockedWorkloadResponse = await memberContext.get(
    `/v1/time/workspace/${owner.currentWorkspace}/workload?range=7d`
  );
  expect(memberBlockedWorkloadResponse.status()).toBe(401);

  const memberBlockedCapacityResponse = await memberContext.get(
    `/v1/time/workspace/${owner.currentWorkspace}/capacity?range=7d`
  );
  expect(memberBlockedCapacityResponse.status()).toBe(401);

  const memberPersonalDashboardResponse = await memberContext.get(
    `/v1/dashboard/workspace/${owner.currentWorkspace}/personal?range=7d`
  );
  expect(memberPersonalDashboardResponse.status()).toBe(200);

  const memberTeamDashboardResponse = await memberContext.get(
    `/v1/dashboard/workspace/${owner.currentWorkspace}/team?range=7d`
  );
  expect(memberTeamDashboardResponse.status()).toBe(200);

  const memberTimelineResponse = await memberContext.get(
    `/v1/timeline/workspace/${owner.currentWorkspace}?startDate=${timelineStart}&endDate=${timelineEnd}`
  );
  expect(memberTimelineResponse.status()).toBe(200);

  const memberGanttResponse = await memberContext.get(
    `/v1/gantt/workspace/${owner.currentWorkspace}?startDate=${timelineStart}&endDate=${timelineEnd}`
  );
  expect(memberGanttResponse.status()).toBe(200);

  const memberBlockedScheduleResponse = await memberContext.put(
    `/v1/task/${timelineTaskId}/workspace/${owner.currentWorkspace}/schedule`,
    {
      headers: memberCsrf,
      data: {
        startDate: dateInput(5),
        endDate: dateInput(9),
      },
    }
  );
  expect(memberBlockedScheduleResponse.status()).toBe(200);

  const memberMilestonesResponse = await memberContext.get(
    `/v1/milestone/workspace/${owner.currentWorkspace}`
  );
  expect(memberMilestonesResponse.status()).toBe(200);

  const memberBlockedMilestoneCreateResponse = await memberContext.post(
    `/v1/milestone/workspace/${owner.currentWorkspace}`,
    {
      headers: memberCsrf,
      data: {
        project: projectId,
        name: "Member Milestone",
      },
    }
  );
  expect(memberBlockedMilestoneCreateResponse.status()).toBe(401);

  const memberBlockedMilestoneDeleteResponse = await memberContext.delete(
    `/v1/milestone/workspace/${owner.currentWorkspace}/${milestoneId}`,
    {
      headers: memberCsrf,
    }
  );
  expect(memberBlockedMilestoneDeleteResponse.status()).toBe(401);

  const memberExecutiveDashboardResponse = await memberContext.get(
    `/v1/dashboard/workspace/${owner.currentWorkspace}/executive?range=7d`
  );
  expect(memberExecutiveDashboardResponse.status()).toBe(403);

  const memberBlockedDependencyResponse = await memberContext.post(
    `/v1/task/${taskId}/workspace/${owner.currentWorkspace}/dependencies`,
    {
      headers: memberCsrf,
      data: {
        predecessorTaskId,
      },
    }
  );
  expect(memberBlockedDependencyResponse.status()).toBe(401);

  const memberBlockedRecurrenceResponse = await memberContext.put(
    `/v1/task/${taskId}/workspace/${owner.currentWorkspace}/recurrence`,
    {
      headers: memberCsrf,
      data: {
        enabled: true,
        frequency: "DAILY",
        interval: 1,
      },
    }
  );
  expect(memberBlockedRecurrenceResponse.status()).toBe(401);

  const memberKanbanResponse = await memberContext.get(
    `/v1/task/workspace/${owner.currentWorkspace}/kanban?projectId=${projectId}`
  );
  expect(memberKanbanResponse.status()).toBe(200);

  const memberSearchResponse = await memberContext.get(
    `/v1/search/workspace/${owner.currentWorkspace}?q=${encodeURIComponent(
      member.user.name.slice(0, 3)
    )}&types=MEMBER`
  );
  expect(memberSearchResponse.status()).toBe(200);
  const memberSearchBody = await memberSearchResponse.json();
  expect(memberSearchBody.groups[0].results[0]).toMatchObject({
    type: "MEMBER",
    canView: true,
  });

  const memberWatchResponse = await memberContext.post(
    `/v1/task/${taskId}/workspace/${owner.currentWorkspace}/watch`,
    {
      headers: memberCsrf,
    }
  );
  expect(memberWatchResponse.status()).toBe(201);

  const assignTaskResponse = await ownerContext.put(
    `/v1/task/${taskId}/project/${projectId}/workspace/${owner.currentWorkspace}/update`,
    {
      headers: ownerCsrf,
      data: {
        assignedTo: member.userId,
      },
    }
  );
  expect(assignTaskResponse.status()).toBe(200);

  const notificationCommentResponse = await ownerContext.post(
    `/v1/comment/workspace/${owner.currentWorkspace}/target/TASK/${taskId}`,
    {
      headers: ownerCsrf,
      data: commentPayload("Assignee notification comment"),
    }
  );
  expect(notificationCommentResponse.status()).toBe(201);

  const mentionNotificationResponse = await ownerContext.post(
    `/v1/comment/workspace/${owner.currentWorkspace}/target/TASK/${taskId}`,
    {
      headers: ownerCsrf,
      data: mentionCommentPayload("Mention notification", member.userId),
    }
  );
  expect(mentionNotificationResponse.status()).toBe(201);

  const notificationFileResponse = await ownerContext.post(
    `/v1/file/workspace/${owner.currentWorkspace}/target/TASK/${taskId}`,
    {
      headers: ownerCsrf,
      multipart: {
        file: {
          name: "notification-file.png",
          mimeType: "image/png",
          buffer: pngBuffer,
        },
      },
    }
  );
  expect(notificationFileResponse.status()).toBe(201);

  const memberUnreadResponse = await memberContext.get(
    `/v1/notification/workspace/${owner.currentWorkspace}/unread-count`
  );
  expect(memberUnreadResponse.status()).toBe(200);
  const memberUnreadBody = await memberUnreadResponse.json();
  expect(memberUnreadBody.unreadCount).toBeGreaterThanOrEqual(4);

  const memberNotificationsResponse = await memberContext.get(
    `/v1/notification/workspace/${owner.currentWorkspace}?pageSize=20&pageNumber=1`
  );
  expect(memberNotificationsResponse.status()).toBe(200);
  const memberNotificationsBody = await memberNotificationsResponse.json();
  const notificationTypes = memberNotificationsBody.notifications.map(
    (notification: { type: string }) => notification.type
  );
  expect(notificationTypes).toEqual(
    expect.arrayContaining([
      "TASK_ASSIGNED",
      "COMMENT_ADDED",
      "MENTION_RECEIVED",
      "FILE_UPLOADED",
      "TASK_UPDATED",
    ])
  );
  expect(notificationTypes).not.toContain("DUE_DATE_APPROACHING");

  const notificationToRead = memberNotificationsBody.notifications[0]._id;
  const markReadResponse = await memberContext.put(
    `/v1/notification/workspace/${owner.currentWorkspace}/${notificationToRead}/read`,
    {
      headers: memberCsrf,
    }
  );
  expect(markReadResponse.status()).toBe(200);

  const preferencesResponse = await memberContext.get(
    `/v1/notification/workspace/${owner.currentWorkspace}/settings`
  );
  expect(preferencesResponse.status()).toBe(200);
  const preferencesBody = await preferencesResponse.json();
  expect(preferencesBody.preferences.TASK_ASSIGNED).toBe(true);

  const updatePreferencesResponse = await memberContext.put(
    `/v1/notification/workspace/${owner.currentWorkspace}/settings`,
    {
      headers: memberCsrf,
      data: {
        preferences: {
          FILE_UPLOADED: false,
        },
      },
    }
  );
  expect(updatePreferencesResponse.status()).toBe(200);
  const updatePreferencesBody = await updatePreferencesResponse.json();
  expect(updatePreferencesBody.preferences.FILE_UPLOADED).toBe(false);

  const ownerNotificationsResponse = await ownerContext.get(
    `/v1/notification/workspace/${owner.currentWorkspace}?pageSize=20&pageNumber=1`
  );
  expect(ownerNotificationsResponse.status()).toBe(200);
  const ownerNotificationsBody = await ownerNotificationsResponse.json();
  expect(
    ownerNotificationsBody.notifications.map(
      (notification: { type: string }) => notification.type
    )
  ).toContain("INVITE_ACCEPTED");

  const blockedFileDeleteResponse = await memberContext.delete(
    `/v1/file/workspace/${owner.currentWorkspace}/${taskFileId}`,
    {
      headers: memberCsrf,
    }
  );
  expect(blockedFileDeleteResponse.status()).toBe(403);

  const memberReplyResponse = await memberContext.post(
    `/v1/comment/workspace/${owner.currentWorkspace}/${commentId}/reply`,
    {
      headers: memberCsrf,
      data: commentPayload("Member reply"),
    }
  );
  expect(memberReplyResponse.status()).toBe(201);
  const memberReplyBody = await memberReplyResponse.json();
  const replyId = memberReplyBody.reply._id as string;

  const blockedEditResponse = await memberContext.put(
    `/v1/comment/workspace/${owner.currentWorkspace}/${commentId}`,
    {
      headers: memberCsrf,
      data: commentPayload("Member should not edit owner comment"),
    }
  );
  expect(blockedEditResponse.status()).toBe(403);

  const activityResponse = await ownerContext.get(
    `/v1/activity/workspace/${owner.currentWorkspace}?targetType=TASK&targetId=${taskId}`
  );
  expect(activityResponse.status()).toBe(200);
  const activityBody = await activityResponse.json();
  expect(activityBody.activities.length).toBeGreaterThanOrEqual(2);

  const deleteReplyResponse = await ownerContext.delete(
    `/v1/comment/workspace/${owner.currentWorkspace}/${replyId}`,
    {
      headers: ownerCsrf,
    }
  );
  expect(deleteReplyResponse.status()).toBe(200);

  const deleteFileResponse = await ownerContext.delete(
    `/v1/file/workspace/${owner.currentWorkspace}/${taskFileId}`,
    {
      headers: ownerCsrf,
    }
  );
  expect(deleteFileResponse.status()).toBe(200);

  const deleteMilestoneResponse = await ownerContext.delete(
    `/v1/milestone/workspace/${owner.currentWorkspace}/${milestoneId}`,
    {
      headers: ownerCsrf,
    }
  );
  expect(deleteMilestoneResponse.status()).toBe(200);
  const deletedMilestone = await MilestoneModel.findById(milestoneId)
    .select("deletedAt")
    .lean();
  expect(deletedMilestone?.deletedAt).toBeTruthy();

  const forbiddenDeleteResponse = await memberContext.delete(
    `/v1/project/${projectId}/workspace/${owner.currentWorkspace}/delete`,
    {
      headers: memberCsrf,
    }
  );
  expect(forbiddenDeleteResponse.status()).toBe(401);

  await ownerContext.dispose();
  await memberContext.dispose();
});

test("workspace deletion repairs currentWorkspace for every affected member", async () => {
  const ownerContext = await request.newContext({ baseURL });
  const memberContext = await request.newContext({ baseURL });

  const owner = await registerAndLogin(ownerContext, "DeleteOwner");
  const ownerCsrf = await getCsrfHeaders(ownerContext);

  const workspaceResponse = await ownerContext.get(
    `/v1/workspace/${owner.currentWorkspace}`
  );
  expect(workspaceResponse.status()).toBe(200);
  const workspaceBody = await workspaceResponse.json();

  const member = await registerAndLogin(memberContext, "DeleteMember");
  const memberCsrf = await getCsrfHeaders(memberContext);

  const joinResponse = await memberContext.post(
    `/v1/member/workspace/${workspaceBody.workspace.inviteCode}/join`,
    {
      headers: memberCsrf,
    }
  );
  expect(joinResponse.status()).toBe(200);

  await UserModel.updateOne(
    { _id: member.userId },
    { $set: { currentWorkspace: owner.currentWorkspace } }
  );

  const deleteResponse = await ownerContext.delete(
    `/v1/workspace/delete/${owner.currentWorkspace}`,
    {
      headers: ownerCsrf,
    }
  );
  expect(deleteResponse.status()).toBe(200);

  const memberCurrentResponse = await memberContext.get("/v1/user/current");
  expect(memberCurrentResponse.status()).toBe(200);
  const memberCurrentBody = await memberCurrentResponse.json();
  const repairedWorkspace =
    memberCurrentBody.user.currentWorkspace?._id ??
    memberCurrentBody.user.currentWorkspace;

  expect(repairedWorkspace).toBe(member.currentWorkspace);
  expect(repairedWorkspace).not.toBe(owner.currentWorkspace);

  await ownerContext.dispose();
  await memberContext.dispose();
});
