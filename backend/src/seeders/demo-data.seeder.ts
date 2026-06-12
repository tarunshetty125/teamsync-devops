import "dotenv/config";
import crypto from "crypto";
import mongoose, { Types } from "mongoose";
import connectDatabase from "../config/database.config";
import { config } from "../config/app.config";
import AccountModel from "../models/account.model";
import ActivityModel from "../models/activity.model";
import AuditLogModel from "../models/audit-log.model";
import CommentModel from "../models/comment.model";
import ExportJobModel, {
  ExportDatasetEnum,
  ExportFormatEnum,
  ExportStatusEnum,
} from "../models/export-job.model";
import FileAssetModel from "../models/file-asset.model";
import LabelModel from "../models/label.model";
import LoginEventModel from "../models/login-event.model";
import MemberModel from "../models/member.model";
import MentionModel from "../models/mention.model";
import MilestoneModel from "../models/milestone.model";
import NotificationModel from "../models/notification.model";
import ProjectModel from "../models/project.model";
import RoleModel from "../models/roles-permission.model";
import SessionRecordModel from "../models/session-record.model";
import TaskDependencyModel from "../models/task-dependency.model";
import TaskModel from "../models/task.model";
import TaskWatcherModel from "../models/task-watcher.model";
import TimeEntryModel from "../models/time-entry.model";
import UserModel from "../models/user.model";
import WorkspacePolicyModel, {
  defaultWorkspacePolicy,
} from "../models/workspace-policy.model";
import WorkspaceModel from "../models/workspace.model";
import { ProviderEnum } from "../enums/account-provider.enum";
import {
  ActivityTypeEnum,
  AuditActionEnum,
  CommentTargetTypeEnum,
  DomainEntityTypeEnum,
  FileAssetStatusEnum,
  FileStorageProviderEnum,
  MilestoneStatusEnum,
  NotificationCategoryEnum,
  NotificationTypeEnum,
  TimeEntrySourceEnum,
} from "../enums/domain.enum";
import {
  TaskDependencyTypeEnum,
  TaskPriorityEnum,
  TaskRecurrenceFrequencyEnum,
  TaskStatusEnum,
  TaskWatcherSourceEnum,
} from "../enums/task.enum";
import { Permissions, Roles } from "../enums/role.enum";
import { hashValue } from "../utils/bcrypt";
import { RolePermissions } from "../utils/role-permission";

type SeedDoc = Record<string, unknown> & { _id: Types.ObjectId };

type UserSeed = {
  id: Types.ObjectId;
  email: string;
  name: string;
  kind: "OWNER" | "ADMIN" | "MEMBER";
  index: number;
};

type WorkspaceSeed = {
  id: Types.ObjectId;
  key: string;
  name: string;
  owner: UserSeed;
  admins: UserSeed[];
  members: UserSeed[];
};

type ProjectSeed = {
  id: Types.ObjectId;
  key: string;
  workspace: WorkspaceSeed;
  name: string;
};

type TaskSeed = {
  id: Types.ObjectId;
  key: string;
  project: ProjectSeed;
  workspace: WorkspaceSeed;
  title: string;
  taskCode: string;
  assignee: UserSeed;
  createdBy: UserSeed;
  status: string;
  priority: string;
  labels: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date;
  startDate: Date;
  endDate: Date;
  completedAt: Date | null;
  parentTask: Types.ObjectId | null;
};

type CommentSeed = {
  id: Types.ObjectId;
  task: TaskSeed;
  author: UserSeed;
  mentionedUser: UserSeed | null;
};

const DEMO_PREFIX = "teamsync-demo";
const PASSWORD = "Password@123";
const BATCH_SIZE = 1000;
const now = new Date();

const firstNames = [
  "Aarav",
  "Priya",
  "Rahul",
  "Ananya",
  "Vikram",
  "Meera",
  "Rohan",
  "Isha",
  "Kabir",
  "Nisha",
  "Arjun",
  "Kavya",
  "Dev",
  "Tara",
  "Aditya",
  "Sneha",
  "Karan",
  "Pooja",
  "Neel",
  "Riya",
  "Sofia",
  "Ethan",
  "Maya",
  "Liam",
  "Olivia",
  "Noah",
  "Emma",
  "Lucas",
  "Ava",
  "Mason",
];

const lastNames = [
  "Sharma",
  "Patel",
  "Kumar",
  "Singh",
  "Rao",
  "Gupta",
  "Mehta",
  "Nair",
  "Iyer",
  "Kapoor",
  "Desai",
  "Joshi",
  "Reddy",
  "Menon",
  "Chopra",
  "Malhotra",
  "Brown",
  "Wilson",
  "Garcia",
  "Miller",
  "Davis",
  "Lopez",
  "Clark",
  "Lewis",
  "Walker",
];

const workspaceNames = [
  "Acme Technologies",
  "Blue Ocean Labs",
  "Nova Commerce",
  "Pixel Systems",
  "CloudWorks",
  "FinEdge",
  "HealthSync",
  "GreenLeaf",
  "BrightPath",
  "Northstar Digital",
  "UrbanGrid",
  "Quantum Harbor",
  "Apex Studio",
  "Vertex Retail",
  "Silverline Ops",
  "Cedar Analytics",
  "Orbit Works",
  "FreshCart",
  "Summit Apps",
  "Atlas Growth",
];

const projectNames = [
  "Mobile App Redesign",
  "CRM Migration",
  "Customer Portal",
  "Analytics Platform",
  "Marketing Website",
  "Internal Tools",
  "Billing Refresh",
  "Partner API",
  "Security Hardening",
  "Onboarding Experience",
];

const taskTitles = [
  "Design onboarding flow",
  "Implement workspace filters",
  "Audit permission checks",
  "Build project summary cards",
  "Tune dashboard aggregation",
  "Review mobile navigation",
  "Prepare launch checklist",
  "Fix task validation errors",
  "Update analytics queries",
  "Write acceptance tests",
  "Document release process",
  "Create loading states",
  "Improve search ranking",
  "Validate export payloads",
  "Polish calendar interactions",
];

const labelTemplates = [
  ["Frontend", "#2563eb"],
  ["Backend", "#16a34a"],
  ["Design", "#db2777"],
  ["QA", "#f59e0b"],
  ["Security", "#dc2626"],
  ["Analytics", "#7c3aed"],
  ["Customer", "#0891b2"],
  ["Ops", "#475569"],
] as const;

const fileTemplates = [
  ["requirements.pdf", "application/pdf", 148_000],
  ["wireframes.pdf", "application/pdf", 225_000],
  ["design.png", "image/png", 84_000],
  ["report.pdf", "application/pdf", 176_000],
] as const;

const oid = (key: string) =>
  new Types.ObjectId(
    crypto.createHash("sha1").update(`${DEMO_PREFIX}:${key}`).digest("hex").slice(0, 24)
  );

const hashText = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const inviteCodeForWorkspace = (workspaceKey: string) =>
  hashText(`${DEMO_PREFIX}:invite:${workspaceKey}`).slice(0, 8);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const addHours = (date: Date, hours: number) => {
  const next = new Date(date);
  next.setUTCHours(next.getUTCHours() + hours);
  return next;
};

const pad = (value: number, size: number) => String(value).padStart(size, "0");

const pick = <T>(values: readonly T[], seed: number) => values[seed % values.length];

const bodyJson = (plainText: string) => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: plainText }],
    },
  ],
});

const guardDemoSeed = () => {
  if (config.NODE_ENV === "development" || process.env.ALLOW_DEMO_SEED === "true") {
    return;
  }

  throw new Error(
    "Demo seed is disabled. Set NODE_ENV=development or ALLOW_DEMO_SEED=true to run it."
  );
};

const withoutId = (doc: SeedDoc) => {
  const { _id, ...rest } = doc;
  return rest;
};

const upsertMany = async (
  label: string,
  model: { collection: { bulkWrite: (ops: any[], options?: any) => Promise<unknown> } },
  docs: SeedDoc[]
) => {
  for (let index = 0; index < docs.length; index += BATCH_SIZE) {
    const chunk = docs.slice(index, index + BATCH_SIZE);
    await model.collection.bulkWrite(
      chunk.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: withoutId(doc), $setOnInsert: { _id: doc._id } },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }
  console.log(`${label}: ${docs.length}`);
};

const ensureSystemRoles = async () => {
  const roleIds: Record<string, Types.ObjectId> = {};

  for (const roleName of Object.values(Roles)) {
    const role = await RoleModel.findOneAndUpdate(
      { name: roleName, isSystem: true },
      {
        $set: {
          name: roleName,
          permissions: RolePermissions[roleName],
          isSystem: true,
          workspace: null,
          deletedAt: null,
          deletedBy: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    roleIds[roleName] = role._id as Types.ObjectId;
  }

  return roleIds;
};

const buildUsers = (): UserSeed[] => {
  const users: UserSeed[] = [];

  for (let index = 1; index <= 2; index += 1) {
    users.push({
      id: oid(`user:owner:${index}`),
      email: `owner${pad(index, 2)}@teamsync.demo`,
      name: `${pick(firstNames, index)} ${pick(lastNames, index)}`,
      kind: "OWNER",
      index,
    });
  }

  for (let index = 1; index <= 2; index += 1) {
    users.push({
      id: oid(`user:admin:${index}`),
      email: `admin${pad(index, 2)}@teamsync.demo`,
      name: `${pick(firstNames, index + 8)} ${pick(lastNames, index + 5)}`,
      kind: "ADMIN",
      index,
    });
  }

  for (let index = 1; index <= 196; index += 1) {
    users.push({
      id: oid(`user:member:${index}`),
      email: `member${pad(index, 3)}@teamsync.demo`,
      name: `${pick(firstNames, index + 13)} ${pick(lastNames, index + 21)}`,
      kind: "MEMBER",
      index,
    });
  }

  return users;
};

const buildWorkspaces = (users: UserSeed[]): WorkspaceSeed[] => {
  const owners = users.filter((user) => user.kind === "OWNER");
  const admins = users.filter((user) => user.kind === "ADMIN");
  const members = users.filter((user) => user.kind === "MEMBER");

  return workspaceNames.map((name, index) => {
    const memberCount = 7 + (index % 9);
    const start = (index * 9) % members.length;
    const workspaceMembers = Array.from({ length: memberCount }, (_, offset) =>
      members[(start + offset) % members.length]
    );

    return {
      id: oid(`workspace:${index + 1}`),
      key: `workspace:${index + 1}`,
      name,
      owner: owners[index % owners.length],
      admins,
      members: workspaceMembers,
    };
  });
};

const buildProjects = (workspaces: WorkspaceSeed[]): ProjectSeed[] =>
  workspaces.flatMap((workspace, workspaceIndex) =>
    Array.from({ length: 5 }, (_, projectIndex) => ({
      id: oid(`project:${workspaceIndex + 1}:${projectIndex + 1}`),
      key: `project:${workspaceIndex + 1}:${projectIndex + 1}`,
      workspace,
      name: projectNames[(workspaceIndex + projectIndex) % projectNames.length],
    }))
  );

const workspaceUsers = (workspace: WorkspaceSeed) => [
  workspace.owner,
  ...workspace.admins,
  ...workspace.members,
];

const completedAtFor = (createdAt: Date, dueDate: Date, seed: number) => {
  const latest = dueDate.getTime() < now.getTime() ? dueDate : addDays(now, -1 - (seed % 18));
  const completedAt = addDays(createdAt, 2 + (seed % 20));
  return completedAt.getTime() > latest.getTime() ? latest : completedAt;
};

const run = async () => {
  guardDemoSeed();
  await connectDatabase();

  const roleIds = await ensureSystemRoles();
  const users = buildUsers();
  const workspaces = buildWorkspaces(users);
  const projects = buildProjects(workspaces);
  const passwordHash = await hashValue(PASSWORD);

  const firstWorkspaceByUser = new Map<string, Types.ObjectId>();
  for (const workspace of workspaces) {
    for (const user of workspaceUsers(workspace)) {
      const key = user.id.toString();
      if (!firstWorkspaceByUser.has(key)) {
        firstWorkspaceByUser.set(key, workspace.id);
      }
    }
  }

  const userDocs: SeedDoc[] = users.map((user, index) => ({
    _id: user.id,
    name: user.name,
    email: user.email,
    password: passwordHash,
    profilePicture: null,
    bio: `${user.name} works on product delivery, planning, and collaboration in TeamSync demo workspaces.`,
    timezone: pick(["Asia/Kolkata", "America/New_York", "Europe/London"], index),
    preferences: {},
    isActive: true,
    lastLogin: addDays(now, -(index % 14)),
    currentWorkspace: firstWorkspaceByUser.get(user.id.toString()) || workspaces[0].id,
    createdAt: addDays(now, -180 + (index % 30)),
    updatedAt: addDays(now, -(index % 10)),
  }));

  const accountDocs: SeedDoc[] = users.map((user) => ({
    _id: oid(`account:email:${user.email}`),
    userId: user.id,
    provider: ProviderEnum.EMAIL,
    providerId: user.email,
    refreshToken: null,
    tokenExpiry: null,
    createdAt: addDays(now, -170),
    updatedAt: addDays(now, -1),
  }));

  const workspaceDocs: SeedDoc[] = workspaces.map((workspace, index) => ({
    _id: workspace.id,
    name: workspace.name,
    description: `${workspace.name} demo workspace with seeded projects, tasks, analytics, governance, and productivity history.`,
    owner: workspace.owner.id,
    inviteCode: inviteCodeForWorkspace(workspace.key),
    createdAt: addDays(now, -160 + index),
    updatedAt: addDays(now, -index),
  }));

  const customRoleDocs: SeedDoc[] = workspaces.flatMap((workspace, index) => [
    {
      _id: oid(`role:${workspace.key}:project-lead`),
      workspace: workspace.id,
      name: "Project Lead",
      description: "Can manage project delivery, tasks, comments, and files.",
      permissions: [
        Permissions.VIEW_ONLY,
        Permissions.CREATE_PROJECT,
        Permissions.EDIT_PROJECT,
        Permissions.CREATE_TASK,
        Permissions.EDIT_TASK,
        Permissions.DELETE_TASK,
        Permissions.MANAGE_TASK_RELATIONS,
        Permissions.CREATE_COMMENT,
        Permissions.EDIT_COMMENT,
        Permissions.DELETE_COMMENT,
        Permissions.UPLOAD_FILE,
        Permissions.TRACK_TIME,
      ],
      isSystem: false,
      createdBy: workspace.owner.id,
      deletedAt: null,
      deletedBy: null,
      createdAt: addDays(now, -120 + index),
      updatedAt: addDays(now, -10),
    },
    {
      _id: oid(`role:${workspace.key}:analyst`),
      workspace: workspace.id,
      name: "Operations Analyst",
      description: "Can view analytics, track time, and contribute comments.",
      permissions: [
        Permissions.VIEW_ONLY,
        Permissions.CREATE_COMMENT,
        Permissions.EDIT_COMMENT,
        Permissions.TRACK_TIME,
        Permissions.VIEW_TIMESHEETS,
      ],
      isSystem: false,
      createdBy: workspace.owner.id,
      deletedAt: null,
      deletedBy: null,
      createdAt: addDays(now, -110 + index),
      updatedAt: addDays(now, -8),
    },
  ]);

  const memberDocs: SeedDoc[] = workspaces.flatMap((workspace, workspaceIndex) => {
    const docs: SeedDoc[] = [
      {
        _id: oid(`member:${workspace.key}:${workspace.owner.email}`),
        userId: workspace.owner.id,
        workspaceId: workspace.id,
        role: roleIds[Roles.OWNER],
        joinedAt: addDays(now, -155 + workspaceIndex),
        capacityHoursPerWeek: 40,
        status: "ACTIVE",
        deactivatedAt: null,
        deactivatedBy: null,
        lastActiveAt: addHours(now, -workspaceIndex),
        createdAt: addDays(now, -155 + workspaceIndex),
        updatedAt: addDays(now, -workspaceIndex),
      },
      ...workspace.admins.map((admin, adminIndex) => ({
        _id: oid(`member:${workspace.key}:${admin.email}`),
        userId: admin.id,
        workspaceId: workspace.id,
        role: roleIds[Roles.ADMIN],
        joinedAt: addDays(now, -150 + workspaceIndex + adminIndex),
        capacityHoursPerWeek: 38 + adminIndex,
        status: "ACTIVE",
        deactivatedAt: null,
        deactivatedBy: null,
        lastActiveAt: addHours(now, -(adminIndex + 2)),
        createdAt: addDays(now, -150 + workspaceIndex + adminIndex),
        updatedAt: addDays(now, -adminIndex),
      })),
    ];

    workspace.members.forEach((member, memberIndex) => {
      const customRole =
        memberIndex === 0
          ? oid(`role:${workspace.key}:project-lead`)
          : memberIndex === 1
            ? oid(`role:${workspace.key}:analyst`)
            : roleIds[Roles.MEMBER];

      docs.push({
        _id: oid(`member:${workspace.key}:${member.email}`),
        userId: member.id,
        workspaceId: workspace.id,
        role: customRole,
        joinedAt: addDays(now, -140 + workspaceIndex + memberIndex),
        capacityHoursPerWeek: 32 + ((workspaceIndex + memberIndex) % 17),
        status: "ACTIVE",
        deactivatedAt: null,
        deactivatedBy: null,
        lastActiveAt: addHours(now, -((workspaceIndex + memberIndex) % 72)),
        createdAt: addDays(now, -140 + workspaceIndex + memberIndex),
        updatedAt: addDays(now, -(memberIndex % 20)),
      });
    });

    return docs;
  });

  const policyDocs: SeedDoc[] = workspaces.map((workspace, index) => ({
    _id: oid(`policy:${workspace.key}`),
    workspace: workspace.id,
    comments: defaultWorkspacePolicy.comments,
    files: {
      maxUploadBytes: 10 * 1024 * 1024,
      allowedMimeTypes: defaultWorkspacePolicy.files.allowedMimeTypes,
    },
    members: {
      allowSelfInvite: index % 2 === 0,
      allowGuestInvite: false,
    },
    retention: {
      notificationsDays: pick([90, 180, 365, null], index),
      activityDays: pick([180, 365, null], index),
      auditDays: pick([365, null], index),
      commentsDays: pick([180, 365, null], index),
      filesDays: pick([180, 365, null], index),
    },
    updatedBy: workspace.owner.id,
    createdAt: addDays(now, -100 + index),
    updatedAt: addDays(now, -index),
  }));

  const labelDocs: SeedDoc[] = workspaces.flatMap((workspace) =>
    labelTemplates.map(([name, color], index) => ({
      _id: oid(`label:${workspace.key}:${name}`),
      workspace: workspace.id,
      name,
      color,
      description: `${name} work for ${workspace.name}`,
      createdBy: workspace.owner.id,
      deletedAt: null,
      deletedBy: null,
      createdAt: addDays(now, -120 + index),
      updatedAt: addDays(now, -index),
    }))
  );

  const labelsByWorkspace = new Map<string, Types.ObjectId[]>();
  for (const workspace of workspaces) {
    labelsByWorkspace.set(
      workspace.id.toString(),
      labelTemplates.map(([name]) => oid(`label:${workspace.key}:${name}`))
    );
  }

  const projectDocs: SeedDoc[] = projects.map((project, index) => ({
    _id: project.id,
    name: project.name,
    emoji: "PM",
    description: `${project.name} includes planning, execution, collaboration, and reporting demo data.`,
    workspace: project.workspace.id,
    createdBy: project.workspace.owner.id,
    createdAt: addDays(now, -118 + (index % 45)),
    updatedAt: addDays(now, -(index % 25)),
  }));

  const taskDocs: SeedDoc[] = [];
  const tasks: TaskSeed[] = [];
  const statusValues = Object.values(TaskStatusEnum);
  const priorityValues = Object.values(TaskPriorityEnum);

  projects.forEach((project, projectIndex) => {
    const usersInWorkspace = workspaceUsers(project.workspace);
    const workspaceLabels = labelsByWorkspace.get(project.workspace.id.toString()) || [];
    const projectTasks: TaskSeed[] = [];

    for (let taskIndex = 0; taskIndex < 50; taskIndex += 1) {
      const seed = projectIndex * 50 + taskIndex;
      const id = oid(`task:${project.key}:${taskIndex + 1}`);
      const parentTask = taskIndex % 5 === 4 ? projectTasks[taskIndex - 1]?.id || null : null;
      const createdOffset = -120 + (seed % 120);
      const createdAt = addDays(now, createdOffset);
      const durationDays = 5 + (seed % 85);
      const dueDate = addDays(createdAt, durationDays);
      const status = pick(statusValues, seed);
      const completedAt =
        status === TaskStatusEnum.DONE ? completedAtFor(createdAt, dueDate, seed) : null;
      const updatedAt = completedAt || addDays(now, -(seed % 30));
      const selectedLabels = [
        workspaceLabels[seed % workspaceLabels.length],
        workspaceLabels[(seed + 3) % workspaceLabels.length],
      ].filter(Boolean);
      const assignee = usersInWorkspace[(taskIndex + projectIndex) % usersInWorkspace.length];
      const createdBy = usersInWorkspace[(taskIndex + 2) % usersInWorkspace.length];
      const taskCode = `TS-${pad(projectIndex + 1, 3)}-${pad(taskIndex + 1, 3)}`;
      const title = `${pick(taskTitles, seed)} ${pad(taskIndex + 1, 2)}`;
      const recurrenceEnabled = !parentTask && taskIndex % 17 === 0;

      const task: TaskSeed = {
        id,
        key: `task:${project.key}:${taskIndex + 1}`,
        project,
        workspace: project.workspace,
        title,
        taskCode,
        assignee,
        createdBy,
        status,
        priority: pick(priorityValues, seed),
        labels: selectedLabels,
        createdAt,
        updatedAt,
        dueDate,
        startDate: addDays(createdAt, seed % 3),
        endDate: dueDate,
        completedAt,
        parentTask,
      };

      projectTasks.push(task);
      tasks.push(task);

      taskDocs.push({
        _id: id,
        taskCode,
        title,
        description: `${title} for ${project.name}. This task is seeded for dashboards, Kanban, search, Timeline, and Gantt validation.`,
        project: project.id,
        workspace: project.workspace.id,
        status,
        priority: task.priority,
        assignedTo: assignee.id,
        createdBy: createdBy.id,
        startDate: task.startDate,
        endDate: task.endDate,
        dueDate,
        completedAt,
        parentTask,
        rootTask: parentTask,
        subtaskDepth: parentTask ? 1 : 0,
        subtaskOrder: parentTask ? taskIndex : 0,
        labels: selectedLabels,
        checklist: Array.from({ length: 3 }, (_, checklistIndex) => {
          const completed = checklistIndex < (seed % 4);
          return {
            _id: oid(`checklist:${task.key}:${checklistIndex + 1}`),
            text: `Checklist item ${checklistIndex + 1} for ${title}`,
            order: checklistIndex,
            completed,
            completedAt: completed ? addDays(createdAt, checklistIndex + 1) : null,
            completedBy: completed ? assignee.id : null,
            createdBy: createdBy.id,
            createdAt,
            updatedAt,
          };
        }),
        recurrence: {
          enabled: recurrenceEnabled,
          frequency: recurrenceEnabled
            ? pick(Object.values(TaskRecurrenceFrequencyEnum), seed)
            : null,
          interval: recurrenceEnabled ? 1 + (seed % 3) : 1,
          endsAt: recurrenceEnabled ? addDays(now, 90) : null,
          maxOccurrences: recurrenceEnabled ? 8 : null,
          occurrenceIndex: 1,
          seriesRoot: recurrenceEnabled ? id : null,
          previousOccurrence: null,
        },
        generatedFromTaskId: taskIndex % 41 === 0 && taskIndex > 0 ? projectTasks[taskIndex - 1].id : null,
        createdAt,
        updatedAt,
      });
    }
  });

  const dependencies: SeedDoc[] = [];
  projects.forEach((project) => {
    const projectTasks = tasks.filter((task) => task.project.id.equals(project.id));
    for (let index = 0; index < 8; index += 1) {
      const predecessor = projectTasks[index * 5];
      const successor = projectTasks[index * 5 + 1];
      dependencies.push({
        _id: oid(`dependency:${predecessor.key}:${successor.key}`),
        workspace: project.workspace.id,
        predecessorTask: predecessor.id,
        successorTask: successor.id,
        type: TaskDependencyTypeEnum.FINISH_TO_START,
        createdBy: project.workspace.owner.id,
        deletedAt: null,
        deletedBy: null,
        createdAt: addDays(now, -80 + index),
        updatedAt: addDays(now, -10 + index),
      });
    }
  });

  const watcherMap = new Map<string, SeedDoc>();
  for (const task of tasks) {
    const watchers = [
      [task.createdBy, TaskWatcherSourceEnum.CREATOR],
      [task.assignee, TaskWatcherSourceEnum.ASSIGNEE],
      [
        workspaceUsers(task.workspace)[
          (tasks.indexOf(task) + 3) % workspaceUsers(task.workspace).length
        ],
        TaskWatcherSourceEnum.MANUAL,
      ],
    ] as const;

    for (const [user, source] of watchers) {
      const key = `${task.id.toString()}:${user.id.toString()}`;
      if (watcherMap.has(key)) continue;
      watcherMap.set(key, {
        _id: oid(`watcher:${task.key}:${user.email}`),
        workspace: task.workspace.id,
        task: task.id,
        user: user.id,
        source,
        addedBy: task.createdBy.id,
        deletedAt: null,
        deletedBy: null,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      });
    }
  }

  const comments: CommentSeed[] = [];
  const commentDocs: SeedDoc[] = [];
  const mentionDocs: SeedDoc[] = [];
  for (const task of tasks) {
    const participants = workspaceUsers(task.workspace);
    for (let index = 0; index < 5; index += 1) {
      const author = participants[(index + task.taskCode.length) % participants.length];
      const mentionedUser = index % 2 === 0 ? task.assignee : null;
      const id = oid(`comment:${task.key}:${index + 1}`);
      const parentComment = index === 4 ? oid(`comment:${task.key}:1`) : null;
      const plainText = mentionedUser
        ? `${author.name} mentioned ${mentionedUser.name}: API validation should happen before the rollout checkpoint for ${task.title}.`
        : `${author.name} added an update on ${task.title}: progress is moving with the current delivery plan.`;

      comments.push({ id, task, author, mentionedUser });
      commentDocs.push({
        _id: id,
        workspace: task.workspace.id,
        author: author.id,
        targetType: CommentTargetTypeEnum.TASK,
        targetId: task.id,
        parentComment,
        bodyJson: bodyJson(plainText),
        plainText,
        mentions: mentionedUser ? [mentionedUser.id] : [],
        editedAt: index === 3 ? addDays(task.createdAt, 4) : null,
        deletedAt: null,
        deletedBy: null,
        createdAt: addDays(task.createdAt, index + 1),
        updatedAt: addDays(task.createdAt, index + 1),
      });

      if (mentionedUser) {
        mentionDocs.push({
          _id: oid(`mention:${task.key}:${index + 1}:${mentionedUser.email}`),
          workspace: task.workspace.id,
          mentionedUser: mentionedUser.id,
          mentionedBy: author.id,
          sourceType: DomainEntityTypeEnum.COMMENT,
          sourceId: id,
          targetType: CommentTargetTypeEnum.TASK,
          targetId: task.id,
          createdAt: addDays(task.createdAt, index + 1),
          updatedAt: addDays(task.createdAt, index + 1),
        });
      }
    }
  }

  const fileDocs: SeedDoc[] = [
    ...projects.flatMap((project, projectIndex) =>
      [0, 1].map((fileIndex) => {
        const [name, mimeType, sizeBytes] = fileTemplates[(projectIndex + fileIndex) % fileTemplates.length];
        return {
          _id: oid(`file:project:${project.key}:${fileIndex + 1}`),
          workspace: project.workspace.id,
          owner: project.workspace.owner.id,
          targetType: DomainEntityTypeEnum.PROJECT,
          targetId: project.id,
          storageProvider: FileStorageProviderEnum.LOCAL,
          storageKey: `demo/${project.workspace.id}/projects/${project.id}/${name}`,
          originalName: name,
          safeName: name,
          mimeType,
          sizeBytes,
          checksum: hashText(`${project.key}:${name}`),
          status: FileAssetStatusEnum.AVAILABLE,
          metadata: { demo: true },
          deletedAt: null,
          deletedBy: null,
          createdAt: addDays(now, -70 + fileIndex),
          updatedAt: addDays(now, -20 + fileIndex),
        };
      })
    ),
    ...tasks
      .filter((_, index) => index % 5 === 0)
      .map((task, index) => {
        const [name, mimeType, sizeBytes] = fileTemplates[index % fileTemplates.length];
        return {
          _id: oid(`file:task:${task.key}`),
          workspace: task.workspace.id,
          owner: task.assignee.id,
          targetType: DomainEntityTypeEnum.TASK,
          targetId: task.id,
          storageProvider: FileStorageProviderEnum.LOCAL,
          storageKey: `demo/${task.workspace.id}/tasks/${task.id}/${name}`,
          originalName: name,
          safeName: name,
          mimeType,
          sizeBytes,
          checksum: hashText(`${task.key}:${name}`),
          status: FileAssetStatusEnum.AVAILABLE,
          metadata: { demo: true },
          deletedAt: null,
          deletedBy: null,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        };
      }),
  ];

  const notificationTypes = [
    NotificationTypeEnum.TASK_ASSIGNED,
    NotificationTypeEnum.COMMENT_ADDED,
    NotificationTypeEnum.MENTION_RECEIVED,
    NotificationTypeEnum.PROJECT_CREATED,
    NotificationTypeEnum.INVITE_ACCEPTED,
    NotificationTypeEnum.FILE_UPLOADED,
    NotificationTypeEnum.TASK_UPDATED,
  ];
  const notificationDocs: SeedDoc[] = [];
  tasks.forEach((task, index) => {
    const taskComment = comments[index * 5];
    const recipient = index % 4 === 0 ? task.createdBy : task.assignee;
    const actor = workspaceUsers(task.workspace)[index % workspaceUsers(task.workspace).length];
    const firstType = pick(notificationTypes, index);
    const secondType = pick(notificationTypes, index + 3);

    for (const [slot, type] of [firstType, secondType].entries()) {
      const isCommentType =
        type === NotificationTypeEnum.COMMENT_ADDED ||
        type === NotificationTypeEnum.MENTION_RECEIVED;
      const entityType = isCommentType
        ? DomainEntityTypeEnum.COMMENT
        : type === NotificationTypeEnum.PROJECT_CREATED
          ? DomainEntityTypeEnum.PROJECT
          : DomainEntityTypeEnum.TASK;
      const entityId = isCommentType
        ? taskComment.id
        : entityType === DomainEntityTypeEnum.PROJECT
          ? task.project.id
          : task.id;
      const id = oid(`notification:${task.key}:${slot + 1}`);

      notificationDocs.push({
        _id: id,
        workspace: task.workspace.id,
        recipient: recipient.id,
        actor: actor.id,
        type,
        category:
          type === NotificationTypeEnum.PROJECT_CREATED
            ? NotificationCategoryEnum.PROJECT
            : isCommentType
              ? NotificationCategoryEnum.COMMENT
              : type === NotificationTypeEnum.INVITE_ACCEPTED
                ? NotificationCategoryEnum.INVITE
                : NotificationCategoryEnum.TASK,
        entityType,
        entityId,
        title: `${type.replace(/_/g, " ")} in ${task.project.name}`,
        body: `${actor.name} generated a demo ${type.toLowerCase().replace(/_/g, " ")} notification.`,
        dedupeKey: `demo:${id.toString()}`,
        readAt: index % 3 === 0 ? addDays(task.updatedAt, 1) : null,
        metadata: { taskId: task.id.toString(), projectId: task.project.id.toString() },
        deletedAt: null,
        deletedBy: null,
        createdAt: task.updatedAt,
        updatedAt: task.updatedAt,
      });
    }
  });

  const milestoneDocs: SeedDoc[] = projects.flatMap((project, projectIndex) =>
    Array.from({ length: 5 }, (_, milestoneIndex) => {
      const status = pick(Object.values(MilestoneStatusEnum), projectIndex + milestoneIndex);
      const startDate = addDays(now, -60 + milestoneIndex * 18 + (projectIndex % 10));
      const dueDate = addDays(startDate, 14 + (milestoneIndex % 4) * 7);
      return {
        _id: oid(`milestone:${project.key}:${milestoneIndex + 1}`),
        workspace: project.workspace.id,
        project: project.id,
        name: `Milestone ${milestoneIndex + 1}: ${pick(["Discovery", "Design", "Build", "QA", "Launch"], milestoneIndex)}`,
        description: `Planning milestone for ${project.name}.`,
        status,
        startDate,
        dueDate,
        completedAt: status === MilestoneStatusEnum.COMPLETED ? addDays(dueDate, -2) : null,
        createdBy: project.workspace.owner.id,
        deletedAt: null,
        deletedBy: null,
        createdAt: addDays(startDate, -10),
        updatedAt: addDays(now, -(milestoneIndex + 1)),
      };
    })
  );

  const timeEntryDocs: SeedDoc[] = [];
  workspaces.forEach((workspace, workspaceIndex) => {
    const usersInWorkspace = workspaceUsers(workspace);
    const workspaceTasks = tasks.filter((task) => task.workspace.id.equals(workspace.id));
    usersInWorkspace.forEach((user, userIndex) => {
      for (let entryIndex = 0; entryIndex < 12; entryIndex += 1) {
        const task = workspaceTasks[(userIndex * 13 + entryIndex) % workspaceTasks.length];
        const startedAt = addHours(addDays(now, -60 + entryIndex * 5), 9 + (userIndex % 6));
        const durationSeconds = (1 + ((workspaceIndex + userIndex + entryIndex) % 6)) * 1800;
        const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);
        timeEntryDocs.push({
          _id: oid(`time:${workspace.key}:${user.email}:${entryIndex + 1}`),
          workspace: workspace.id,
          user: user.id,
          task: task.id,
          project: task.project.id,
          taskTitle: task.title,
          taskCode: task.taskCode,
          projectName: task.project.name,
          startedAt,
          endedAt,
          durationSeconds,
          note: `Demo ${entryIndex % 2 === 0 ? "timer" : "manual"} entry for ${task.title}.`,
          source: entryIndex % 2 === 0 ? TimeEntrySourceEnum.TIMER : TimeEntrySourceEnum.MANUAL,
          deletedAt: null,
          deletedBy: null,
          createdAt: endedAt,
          updatedAt: endedAt,
        });
      }
    });
  });

  const activityDocs: SeedDoc[] = [
    ...projects.map((project, index) => ({
      _id: oid(`activity:project:${project.key}`),
      workspace: project.workspace.id,
      actor: project.workspace.owner.id,
      type: ActivityTypeEnum.PROJECT_CREATED,
      entityType: DomainEntityTypeEnum.PROJECT,
      entityId: project.id,
      project: project.id,
      task: null,
      summary: `${project.name} was created`,
      metadata: { demo: true },
      requestId: `demo-activity-project-${index + 1}`,
      createdAt: addDays(now, -110 + (index % 60)),
      updatedAt: addDays(now, -110 + (index % 60)),
    })),
    ...tasks
      .filter((_, index) => index % 10 === 0)
      .map((task, index) => ({
        _id: oid(`activity:task:${task.key}`),
        workspace: task.workspace.id,
        actor: task.createdBy.id,
        type: ActivityTypeEnum.TASK_UPDATED,
        entityType: DomainEntityTypeEnum.TASK,
        entityId: task.id,
        project: task.project.id,
        task: task.id,
        summary: `${task.taskCode} moved through ${task.status}`,
        metadata: { status: task.status, demo: true },
        requestId: `demo-activity-task-${index + 1}`,
        createdAt: task.updatedAt,
        updatedAt: task.updatedAt,
      })),
  ];

  const auditDocs: SeedDoc[] = [
    ...projects.map((project, index) => ({
      _id: oid(`audit:project:${project.key}`),
      workspace: project.workspace.id,
      actor: project.workspace.owner.id,
      action: AuditActionEnum.CREATED,
      entityType: DomainEntityTypeEnum.PROJECT,
      entityId: project.id,
      before: undefined,
      after: { name: project.name },
      metadata: { demo: true },
      ipAddress: `10.0.${index % 20}.${10 + (index % 200)}`,
      userAgent: "TeamSync Demo Seeder",
      requestId: `demo-audit-project-${index + 1}`,
      createdAt: addDays(now, -105 + (index % 60)),
      updatedAt: addDays(now, -105 + (index % 60)),
    })),
    ...tasks
      .filter((_, index) => index % 10 === 0)
      .map((task, index) => ({
        _id: oid(`audit:task:${task.key}`),
        workspace: task.workspace.id,
        actor: task.createdBy.id,
        action: AuditActionEnum.UPDATED,
        entityType: DomainEntityTypeEnum.TASK,
        entityId: task.id,
        before: { status: TaskStatusEnum.TODO },
        after: { status: task.status, priority: task.priority },
        metadata: { demo: true },
        ipAddress: `10.1.${index % 20}.${20 + (index % 200)}`,
        userAgent: "TeamSync Demo Seeder",
        requestId: `demo-audit-task-${index + 1}`,
        createdAt: task.updatedAt,
        updatedAt: task.updatedAt,
      })),
    ...customRoleDocs.map((role, index) => ({
      _id: oid(`audit:role:${role._id.toString()}`),
      workspace: role.workspace,
      actor: role.createdBy,
      action: AuditActionEnum.CREATED,
      entityType: DomainEntityTypeEnum.ROLE,
      entityId: role._id,
      before: undefined,
      after: { name: role.name },
      metadata: { demo: true },
      ipAddress: `10.2.${index % 20}.${30 + (index % 200)}`,
      userAgent: "TeamSync Demo Seeder",
      requestId: `demo-audit-role-${index + 1}`,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    })),
  ];

  const exportDocs: SeedDoc[] = workspaces.flatMap((workspace, workspaceIndex) =>
    Object.values(ExportFormatEnum).map((format, formatIndex) => ({
      _id: oid(`export:${workspace.key}:${format}`),
      workspace: workspace.id,
      requestedBy: formatIndex === 0 ? workspace.owner.id : workspace.admins[formatIndex % 2].id,
      datasets: [
        ExportDatasetEnum.TASKS,
        ExportDatasetEnum.PROJECTS,
        ExportDatasetEnum.MEMBERS,
        ExportDatasetEnum.COMMENTS,
      ],
      format,
      status: ExportStatusEnum.COMPLETED,
      storageKey: `demo/${workspace.id}/exports/${format.toLowerCase()}-${workspaceIndex + 1}`,
      fileName: `${workspace.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-export.${format.toLowerCase()}`,
      mimeType:
        format === ExportFormatEnum.XLSX
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : format === ExportFormatEnum.JSON
            ? "application/json"
            : "text/csv",
      sizeBytes: 12_000 + workspaceIndex * 300 + formatIndex * 500,
      errorMessage: null,
      expiresAt: addDays(now, 7),
      deletedAt: null,
      deletedBy: null,
      createdAt: addDays(now, -formatIndex - 1),
      updatedAt: addDays(now, -formatIndex - 1),
    }))
  );

  const sessionDocs: SeedDoc[] = users.flatMap((user, index) =>
    [0, 1].map((sessionIndex) => ({
      _id: oid(`session:${user.email}:${sessionIndex + 1}`),
      sessionIdHash: hashText(`demo-session:${user.email}:${sessionIndex + 1}`),
      user: user.id,
      lastActiveAt: addHours(now, -(index + sessionIndex) % 48),
      expiresAt: addDays(now, 1 + sessionIndex),
      revokedAt: sessionIndex === 1 && index % 5 === 0 ? addDays(now, -1) : null,
      revokedBy: sessionIndex === 1 && index % 5 === 0 ? user.id : null,
      ipAddress: `192.168.${index % 40}.${50 + sessionIndex}`,
      userAgent: sessionIndex === 0 ? "Chrome on macOS" : "Safari on iOS",
      createdAt: addDays(now, -sessionIndex - (index % 10)),
      updatedAt: addHours(now, -(index + sessionIndex) % 48),
    }))
  );

  const loginDocs: SeedDoc[] = users.flatMap((user, index) =>
    [0, 1, 2].map((loginIndex) => ({
      _id: oid(`login:${user.email}:${loginIndex + 1}`),
      user: user.id,
      provider: ProviderEnum.EMAIL,
      success: !(loginIndex === 2 && index % 7 === 0),
      ipAddress: `172.16.${index % 40}.${70 + loginIndex}`,
      userAgent: loginIndex === 0 ? "Chrome on macOS" : "Firefox on Windows",
      createdAt: addDays(now, -loginIndex - (index % 21)),
      updatedAt: addDays(now, -loginIndex - (index % 21)),
    }))
  );

  await upsertMany("Users", UserModel, userDocs);
  await upsertMany("Accounts", AccountModel, accountDocs);
  await upsertMany("Workspaces", WorkspaceModel, workspaceDocs);
  await upsertMany("Custom Roles", RoleModel, customRoleDocs);
  await upsertMany("Members", MemberModel, memberDocs);
  await upsertMany("Workspace Policies", WorkspacePolicyModel, policyDocs);
  await upsertMany("Labels", LabelModel, labelDocs);
  await upsertMany("Projects", ProjectModel, projectDocs);
  await upsertMany("Tasks", TaskModel, taskDocs);
  await upsertMany("Task Dependencies", TaskDependencyModel, dependencies);
  await upsertMany("Task Watchers", TaskWatcherModel, Array.from(watcherMap.values()));
  await upsertMany("Comments", CommentModel, commentDocs);
  await upsertMany("Mentions", MentionModel, mentionDocs);
  await upsertMany("Files", FileAssetModel, fileDocs);
  await upsertMany("Notifications", NotificationModel, notificationDocs);
  await upsertMany("Time Entries", TimeEntryModel, timeEntryDocs);
  await upsertMany("Milestones", MilestoneModel, milestoneDocs);
  await upsertMany("Activities", ActivityModel, activityDocs);
  await upsertMany("Audit Logs", AuditLogModel, auditDocs);
  await upsertMany("Exports", ExportJobModel, exportDocs);
  await upsertMany("Sessions", SessionRecordModel, sessionDocs);
  await upsertMany("Login Events", LoginEventModel, loginDocs);

  console.log("");
  console.log(`Users: ${userDocs.length}`);
  console.log(`Workspaces: ${workspaceDocs.length}`);
  console.log(`Projects: ${projectDocs.length}`);
  console.log(`Tasks: ${taskDocs.length}`);
  console.log(`Comments: ${commentDocs.length}`);
  console.log(`Files: ${fileDocs.length}`);
  console.log(`Notifications: ${notificationDocs.length}`);
  console.log(`Time Entries: ${timeEntryDocs.length}`);
  console.log(`Milestones: ${milestoneDocs.length}`);
  console.log(`Audit Logs: ${auditDocs.length}`);
  console.log("");
  console.log("Demo data generated successfully.");
};

run()
  .catch((error) => {
    console.error("Demo data seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
