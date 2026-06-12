import fs from "fs/promises";
import path from "path";
import { Request } from "express";
import { beforeEach, describe, expect, it } from "vitest";
import {
  CommentTargetTypeEnum,
  DomainEntityTypeEnum,
} from "../src/enums/domain.enum";
import { Permissions, Roles } from "../src/enums/role.enum";
import MemberModel from "../src/models/member.model";
import NotificationModel from "../src/models/notification.model";
import RoleModel from "../src/models/roles-permission.model";
import UserModel from "../src/models/user.model";
import WorkspaceModel from "../src/models/workspace.model";
import { registerUserService } from "../src/services/auth.service";
import { listAuditLogsService } from "../src/services/audit-center.service";
import { createCommentService } from "../src/services/comment.service";
import {
  createExportService,
  deleteExportService,
  getExportForReadService,
  listExportsService,
} from "../src/services/export.service";
import { uploadFileAssetService } from "../src/services/file.service";
import { createProjectService } from "../src/services/project.service";
import {
  assignMemberRoleService,
  createRoleService,
  deleteRoleService,
  listRolesService,
  updateRoleService,
} from "../src/services/role.service";
import {
  createSessionRecord,
  listWorkspaceLoginsService,
  listWorkspaceSessionsService,
  revokeWorkspaceSessionService,
} from "../src/services/session-registry.service";
import { createTaskService } from "../src/services/task.service";
import { createManualTimeEntryService } from "../src/services/time.service";
import {
  getWorkspacePolicyService,
  updateWorkspacePolicyService,
} from "../src/services/workspace-policy.service";
import { RequestContext } from "../src/types/request-context";

const uploadRoot = path.resolve(process.cwd(), "uploads");
const password = "Str0ng!Pass";
const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);

const registerUser = async (email: string, name: string) => {
  const result = await registerUserService({ email, name, password });
  const user = await UserModel.findById(result.userId);
  const workspace = await WorkspaceModel.findById(result.workspaceId);
  if (!user || !workspace) throw new Error("Expected user and workspace");

  return {
    userId: user._id.toString(),
    workspaceId: workspace._id.toString(),
  };
};

const contextFor = (userId: string, workspaceId: string): RequestContext => ({
  requestId: `${userId}-${workspaceId}`,
  userId,
  workspaceId,
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
});

const addMember = async (
  userId: string,
  workspaceId: string,
  roleName = Roles.MEMBER
) => {
  const role = await RoleModel.findOne({ name: roleName, isSystem: true });
  if (!role) throw new Error("Expected role");
  return MemberModel.create({ userId, workspaceId, role: role._id });
};

const makeRequest = (userId: string) =>
  ({
    session: {},
    user: { _id: userId },
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
    get: (header: string) =>
      header.toLowerCase() === "user-agent" ? "vitest" : undefined,
  } as unknown as Request);

describe("enterprise governance services", () => {
  beforeEach(async () => {
    await fs.rm(uploadRoot, { recursive: true, force: true });
  });

  it("manages workspace custom roles and protects system roles", async () => {
    const owner = await registerUser("governance-owner@example.com", "Owner");
    const memberUser = await registerUser("governance-member@example.com", "Member");
    const member = await addMember(memberUser.userId, owner.workspaceId);
    const context = contextFor(owner.userId, owner.workspaceId);

    const created = await createRoleService(context, {
      name: "Reviewer",
      description: "Can review workspace work",
      permissions: [Permissions.VIEW_ONLY, Permissions.CREATE_COMMENT],
    });

    expect(created.role.isSystem).toBe(false);
    expect((await listRolesService(owner.workspaceId, owner.userId)).roles).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Reviewer" })])
    );

    const updated = await updateRoleService(context, created.role._id, {
      name: "Senior Reviewer",
      description: "Can review and comment",
      permissions: [
        Permissions.VIEW_ONLY,
        Permissions.CREATE_COMMENT,
        Permissions.EDIT_COMMENT,
      ],
    });
    expect(updated.role.permissions).toContain(Permissions.EDIT_COMMENT);

    await assignMemberRoleService(context, member._id.toString(), updated.role._id);
    await expect(deleteRoleService(context, updated.role._id)).rejects.toThrow(
      /assigned/i
    );

    const memberRole = await RoleModel.findOne({
      name: Roles.MEMBER,
      isSystem: true,
    });
    await assignMemberRoleService(context, member._id.toString(), memberRole!._id.toString());
    await deleteRoleService(context, updated.role._id);

    await expect(
      createRoleService(context, {
        name: Roles.ADMIN,
        permissions: [Permissions.VIEW_ONLY],
      })
    ).rejects.toThrow(/reserved/i);
  });

  it("updates policies and lists audit records", async () => {
    const owner = await registerUser("governance-policy@example.com", "Owner");
    const context = contextFor(owner.userId, owner.workspaceId);

    const initial = await getWorkspacePolicyService(
      owner.workspaceId,
      owner.userId
    );
    expect(initial.policy.comments.allowEdit).toBe(true);

    const updated = await updateWorkspacePolicyService(context, {
      comments: { allowEdit: false, allowDelete: true },
      files: {
        maxUploadBytes: 2048,
        allowedMimeTypes: ["image/png"],
      },
      retention: {
        notificationsDays: 90,
        activityDays: null,
        auditDays: 365,
        commentsDays: 180,
        filesDays: 180,
      },
    });
    expect(updated.policy.files.allowedMimeTypes).toEqual(["image/png"]);

    const logs = await listAuditLogsService(owner.workspaceId, owner.userId, {
      pageNumber: 1,
      pageSize: 10,
      action: "UPDATED",
    });
    expect(logs.auditLogs.length).toBeGreaterThan(0);
  });

  it("generates CSV, JSON, and XLSX exports and deletes export files", async () => {
    const owner = await registerUser("governance-export@example.com", "Owner");
    const context = contextFor(owner.userId, owner.workspaceId);
    const { project } = await createProjectService(owner.userId, owner.workspaceId, {
      name: "Export Project",
      description: "Exportable project",
    });
    const { task } = await createTaskService(
      owner.workspaceId,
      project._id.toString(),
      owner.userId,
      {
        title: "Export Task",
        status: "TODO",
        priority: "MEDIUM",
      }
    );

    await createCommentService(
      context,
      CommentTargetTypeEnum.TASK,
      task._id.toString(),
      {
        bodyJson: { type: "doc", content: [{ type: "paragraph" }] },
        plainText: "Export comment",
      }
    );
    await uploadFileAssetService(
      context,
      DomainEntityTypeEnum.TASK,
      task._id.toString(),
      { originalName: "export.png", mimeType: "image/png", buffer: pngBuffer }
    );
    await createManualTimeEntryService(context, {
      taskId: task._id.toString(),
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      endedAt: new Date().toISOString(),
    });
    await NotificationModel.create({
      workspace: owner.workspaceId,
      recipient: owner.userId,
      type: "PROJECT_CREATED",
      category: "PROJECT",
      entityType: DomainEntityTypeEnum.PROJECT,
      entityId: project._id,
      title: "Project created",
      body: "Export notification",
    });

    const csv = await createExportService(context, {
      format: "CSV",
      datasets: ["TASKS"],
    });
    expect(csv.exportJob.status).toBe("COMPLETED");

    const json = await createExportService(context, {
      format: "JSON",
      datasets: ["TASKS", "PROJECTS", "MEMBERS", "COMMENTS", "FILES", "TIME_ENTRIES", "AUDIT_LOGS"],
    });
    const xlsx = await createExportService(context, {
      format: "XLSX",
      datasets: ["TASKS", "PROJECTS"],
    });

    const exports = await listExportsService(owner.workspaceId, owner.userId, {
      pageNumber: 1,
      pageSize: 10,
    });
    expect(exports.exportJobs).toHaveLength(3);

    const readable = await getExportForReadService(
      owner.workspaceId,
      owner.userId,
      xlsx.exportJob._id
    );
    await expect(fs.access(readable.filePath)).resolves.toBeUndefined();

    await deleteExportService(context, json.exportJob._id);
    await expect(
      getExportForReadService(owner.workspaceId, owner.userId, json.exportJob._id)
    ).rejects.toThrow(/not found/i);
  });

  it("tracks login history and revokes registry-backed sessions", async () => {
    const owner = await registerUser("governance-session@example.com", "Owner");
    const req = makeRequest(owner.userId);

    await createSessionRecord(req, owner.userId, "EMAIL");

    const sessions = await listWorkspaceSessionsService(
      owner.workspaceId,
      owner.userId,
      { pageNumber: 1, pageSize: 10 }
    );
    expect(sessions.sessions).toHaveLength(1);

    const logins = await listWorkspaceLoginsService(owner.workspaceId, owner.userId, {
      pageNumber: 1,
      pageSize: 10,
    });
    expect(logins.logins[0].provider).toBe("EMAIL");

    await revokeWorkspaceSessionService(
      owner.workspaceId,
      owner.userId,
      sessions.sessions[0].sessionId
    );

    const afterRevoke = await listWorkspaceSessionsService(
      owner.workspaceId,
      owner.userId,
      { pageNumber: 1, pageSize: 10 }
    );
    expect(afterRevoke.sessions).toHaveLength(0);
  });
});
