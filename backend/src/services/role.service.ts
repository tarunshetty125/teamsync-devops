import mongoose from "mongoose";
import {
  AuditActionEnum,
  DomainEntityTypeEnum,
} from "../enums/domain.enum";
import { PermissionType, Roles } from "../enums/role.enum";
import MemberModel from "../models/member.model";
import RoleModel, { RoleDocument } from "../models/roles-permission.model";
import { RequestContext } from "../types/request-context";
import { BadRequestException, NotFoundException } from "../utils/appError";
import { recordAuditLog } from "./audit-log.service";
import { assertOwner, getAssignableRoleOrThrow } from "./governance-access.service";

const systemRoleNames = new Set(Object.values(Roles));

const serializeRole = (role: RoleDocument) => ({
  _id: role._id.toString(),
  workspace: role.workspace?.toString() ?? null,
  name: role.name,
  description: role.description ?? null,
  permissions: role.permissions,
  isSystem: role.isSystem,
  createdBy: role.createdBy?.toString() ?? null,
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
});

export const listRolesService = async (workspaceId: string, userId: string) => {
  await assertOwner(workspaceId, userId);

  const roles = await RoleModel.find({
    deletedAt: null,
    $or: [{ isSystem: true, workspace: null }, { workspace: workspaceId }],
  }).sort({ isSystem: -1, name: 1 });

  return { roles: roles.map(serializeRole) };
};

export const createRoleService = async (
  context: RequestContext,
  input: {
    name: string;
    description?: string | null;
    permissions: PermissionType[];
  }
) => {
  await assertOwner(context.workspaceId, context.userId);

  if (systemRoleNames.has(input.name as keyof typeof Roles)) {
    throw new BadRequestException("System role names are reserved");
  }

  const role = await RoleModel.create({
    workspace: context.workspaceId,
    name: input.name,
    description: input.description ?? null,
    permissions: input.permissions,
    isSystem: false,
    createdBy: context.userId,
  });

  await recordAuditLog(context, {
    action: AuditActionEnum.CREATED,
    entityType: DomainEntityTypeEnum.ROLE,
    entityId: role._id.toString(),
    after: serializeRole(role),
  });

  return { role: serializeRole(role) };
};

export const updateRoleService = async (
  context: RequestContext,
  roleId: string,
  input: {
    name: string;
    description?: string | null;
    permissions: PermissionType[];
  }
) => {
  await assertOwner(context.workspaceId, context.userId);

  if (systemRoleNames.has(input.name as keyof typeof Roles)) {
    throw new BadRequestException("System role names are reserved");
  }

  const role = await RoleModel.findOne({
    _id: roleId,
    workspace: context.workspaceId,
    isSystem: false,
    deletedAt: null,
  });

  if (!role) {
    throw new NotFoundException("Custom role not found");
  }

  const before = serializeRole(role);
  role.name = input.name;
  role.description = input.description ?? null;
  role.permissions = input.permissions;
  await role.save();

  await recordAuditLog(context, {
    action: AuditActionEnum.UPDATED,
    entityType: DomainEntityTypeEnum.ROLE,
    entityId: role._id.toString(),
    before,
    after: serializeRole(role),
  });

  return { role: serializeRole(role) };
};

export const deleteRoleService = async (
  context: RequestContext,
  roleId: string
) => {
  await assertOwner(context.workspaceId, context.userId);

  const role = await RoleModel.findOne({
    _id: roleId,
    workspace: context.workspaceId,
    isSystem: false,
    deletedAt: null,
  });

  if (!role) {
    throw new NotFoundException("Custom role not found");
  }

  const assignedCount = await MemberModel.countDocuments({
    workspaceId: context.workspaceId,
    role: role._id,
    status: { $ne: "DEACTIVATED" },
  });

  if (assignedCount > 0) {
    throw new BadRequestException("Cannot delete a role assigned to members");
  }

  role.deletedAt = new Date();
  role.deletedBy = new mongoose.Types.ObjectId(context.userId);
  await role.save();

  await recordAuditLog(context, {
    action: AuditActionEnum.DELETED,
    entityType: DomainEntityTypeEnum.ROLE,
    entityId: role._id.toString(),
    before: serializeRole(role),
  });
};

export const assignMemberRoleService = async (
  context: RequestContext,
  memberId: string,
  roleId: string
) => {
  await assertOwner(context.workspaceId, context.userId);

  const [role, member] = await Promise.all([
    getAssignableRoleOrThrow(context.workspaceId, roleId),
    MemberModel.findOne({
      _id: memberId,
      workspaceId: context.workspaceId,
      status: { $ne: "DEACTIVATED" },
    }).populate("role"),
  ]);

  if (!member) {
    throw new NotFoundException("Member not found");
  }

  if (role.isSystem && role.name === Roles.OWNER) {
    throw new BadRequestException("Workspace ownership cannot be assigned here");
  }

  const currentRole = member.role as unknown as RoleDocument;
  if (currentRole?.isSystem && currentRole.name === Roles.OWNER) {
    throw new BadRequestException("Workspace owner role cannot be changed");
  }

  const before = {
    memberId,
    roleId: currentRole?._id?.toString(),
    roleName: currentRole?.name,
  };

  member.role = role;
  await member.save();

  await recordAuditLog(context, {
    action: AuditActionEnum.PERMISSION_CHANGED,
    entityType: DomainEntityTypeEnum.MEMBER,
    entityId: member._id.toString(),
    before,
    after: {
      memberId,
      roleId: role._id.toString(),
      roleName: role.name,
    },
  });

  return { member };
};
