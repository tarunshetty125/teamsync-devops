import fs from "fs/promises";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import ActivityModel from "../src/models/activity.model";
import AuditLogModel from "../src/models/audit-log.model";
import FileAssetModel from "../src/models/file-asset.model";
import MemberModel from "../src/models/member.model";
import RoleModel from "../src/models/roles-permission.model";
import UserModel from "../src/models/user.model";
import { DomainEntityTypeEnum, FileAssetStatusEnum } from "../src/enums/domain.enum";
import { Roles } from "../src/enums/role.enum";
import { registerUserService } from "../src/services/auth.service";
import {
  deleteFileAssetService,
  getFileForReadService,
  listFileAssetsForTargetService,
  uploadAvatarService,
  uploadFileAssetService,
} from "../src/services/file.service";
import { createProjectService } from "../src/services/project.service";
import { createTaskService } from "../src/services/task.service";
import { LocalStorageProvider } from "../src/storage/local-storage-provider";
import { RequestContext } from "../src/types/request-context";
import { validateUploadedFile } from "../src/utils/file-validation";

const uploadRoot = path.resolve(process.cwd(), "uploads");
const password = "Str0ng!Pass";
const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const pdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");

const registerUser = async (email: string, name: string) => {
  const result = await registerUserService({
    email,
    name,
    password,
  });

  return {
    userId: result.userId.toString(),
    workspaceId: result.workspaceId.toString(),
  };
};

const makeContext = (userId: string, workspaceId: string): RequestContext => ({
  requestId: `${userId}-${workspaceId}`,
  userId,
  workspaceId,
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
});

const addMemberToWorkspace = async (userId: string, workspaceId: string) => {
  const memberRole = await RoleModel.findOne({ name: Roles.MEMBER });

  if (!memberRole) {
    throw new Error("Expected member role to exist");
  }

  await MemberModel.create({
    userId,
    workspaceId,
    role: memberRole._id,
  });
};

const createTaskTarget = async (owner: { userId: string; workspaceId: string }) => {
  const { project } = await createProjectService(owner.userId, owner.workspaceId, {
    name: "File Project",
    description: "Project with files",
  });

  const { task } = await createTaskService(
    owner.workspaceId,
    project._id.toString(),
    owner.userId,
    {
      title: "File Task",
      description: "Task with files",
      priority: "MEDIUM",
      status: "TODO",
    }
  );

  return { project, task };
};

describe("file validation and local storage", () => {
  beforeEach(async () => {
    await fs.rm(uploadRoot, { recursive: true, force: true });
  });

  it("validates file signatures and sanitizes names", () => {
    const validated = validateUploadedFile({
      buffer: pngBuffer,
      originalName: "../../avatar cool!.exe",
      maxBytes: 1024,
    });

    expect(validated.mimeType).toBe("image/png");
    expect(validated.safeName).toBe("avatar-cool.png");

    expect(() =>
      validateUploadedFile({
        buffer: Buffer.from("not really a pdf"),
        originalName: "invoice.pdf",
        maxBytes: 1024,
      })
    ).toThrow(/unsupported|invalid/i);
  });

  it("prevents local storage path traversal", () => {
    const provider = new LocalStorageProvider(uploadRoot);

    expect(() => provider.resolveStoragePath("../escape.png")).toThrow(
      /outside of the storage root/i
    );
  });
});

describe("file asset services", () => {
  beforeEach(async () => {
    await fs.rm(uploadRoot, { recursive: true, force: true });
  });

  it("uploads, lists, reads, audits, and records activity for task attachments", async () => {
    const owner = await registerUser("file-owner@example.com", "File Owner");
    const { task } = await createTaskTarget(owner);

    const { file } = await uploadFileAssetService(
      makeContext(owner.userId, owner.workspaceId),
      DomainEntityTypeEnum.TASK,
      task._id.toString(),
      {
        originalName: "design.png",
        mimeType: "image/png",
        buffer: pngBuffer,
      }
    );

    expect(file.safeName).toBe("design.png");
    expect(file.previewPath).toContain("/preview");
    expect(file.downloadPath).toContain("/download");
    expect(await ActivityModel.countDocuments({ entityId: file._id })).toBe(1);
    expect(await AuditLogModel.countDocuments({ entityId: file._id })).toBe(1);

    const listed = await listFileAssetsForTargetService(
      owner.workspaceId,
      DomainEntityTypeEnum.TASK,
      task._id.toString(),
      { pageNumber: 1, pageSize: 20 }
    );

    expect(listed.files).toHaveLength(1);

    const readable = await getFileForReadService(owner.workspaceId, file._id);
    expect(readable.filePath).toContain("uploads");
  });

  it("rejects uploads to targets outside the workspace", async () => {
    const owner = await registerUser("file-cross-owner@example.com", "Owner");
    const outsider = await registerUser("file-cross-outsider@example.com", "Outsider");
    const { task } = await createTaskTarget(owner);

    await expect(
      uploadFileAssetService(
        makeContext(outsider.userId, outsider.workspaceId),
        DomainEntityTypeEnum.TASK,
        task._id.toString(),
        {
          originalName: "cross.pdf",
          mimeType: "application/pdf",
          buffer: pdfBuffer,
        }
      )
    ).rejects.toThrow(/does not belong to this workspace/i);
  });

  it("enforces delete ownership and hides soft-deleted files", async () => {
    const owner = await registerUser("file-delete-owner@example.com", "Owner");
    const member = await registerUser("file-delete-member@example.com", "Member");
    await addMemberToWorkspace(member.userId, owner.workspaceId);
    const { task } = await createTaskTarget(owner);

    const { file } = await uploadFileAssetService(
      makeContext(owner.userId, owner.workspaceId),
      DomainEntityTypeEnum.TASK,
      task._id.toString(),
      {
        originalName: "delete-me.pdf",
        mimeType: "application/pdf",
        buffer: pdfBuffer,
      }
    );

    await expect(
      deleteFileAssetService(
        makeContext(member.userId, owner.workspaceId),
        file._id,
        Roles.MEMBER
      )
    ).rejects.toThrow(/only file owners/i);

    await deleteFileAssetService(
      makeContext(owner.userId, owner.workspaceId),
      file._id,
      Roles.OWNER
    );

    const deleted = await FileAssetModel.findById(file._id);
    expect(deleted?.status).toBe(FileAssetStatusEnum.DELETED);
    expect(deleted?.deletedAt).toBeTruthy();

    const listed = await listFileAssetsForTargetService(
      owner.workspaceId,
      DomainEntityTypeEnum.TASK,
      task._id.toString(),
      { pageNumber: 1, pageSize: 20 }
    );
    expect(listed.files).toHaveLength(0);
  });

  it("updates avatar references and retires previous avatar files", async () => {
    const owner = await registerUser("avatar-owner@example.com", "Avatar Owner");
    const context = makeContext(owner.userId, owner.workspaceId);

    const first = await uploadAvatarService(context, {
      originalName: "first.png",
      mimeType: "image/png",
      buffer: pngBuffer,
    });
    const second = await uploadAvatarService(context, {
      originalName: "second.png",
      mimeType: "image/png",
      buffer: pngBuffer,
    });

    const user = await UserModel.findById(owner.userId);
    const retiredFirst = await FileAssetModel.findById(first.file._id);
    const currentSecond = await FileAssetModel.findById(second.file._id);

    expect(user?.profilePicture).toBe(second.profilePicture);
    expect(retiredFirst?.status).toBe(FileAssetStatusEnum.DELETED);
    expect(currentSecond?.status).toBe(FileAssetStatusEnum.AVAILABLE);
  });
});
