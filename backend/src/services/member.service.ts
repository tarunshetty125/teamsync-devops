import mongoose from "mongoose";
import { ErrorCodeEnum } from "../enums/error-code.enum";
import { PermissionType, Roles } from "../enums/role.enum";
import {
  AuditActionEnum,
  DomainEntityTypeEnum,
} from "../enums/domain.enum";
import MemberModel from "../models/member.model";
import RoleModel from "../models/roles-permission.model";
import WorkspaceModel from "../models/workspace.model";
import UserModel from "../models/user.model";
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "../utils/appError";
import { RolePermissions } from "../utils/role-permission";
import { getOrCreateWorkspacePolicy } from "./workspace-policy.service";
import { RequestContext } from "../types/request-context";
import { recordAuditLog } from "./audit-log.service";
import { assertOwnerOrAdmin, getAssignableRoleOrThrow } from "./governance-access.service";

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

export const getMemberRoleInWorkspace = async (
  userId: string,
  workspaceId: string
) => {
  const workspace = await WorkspaceModel.findById(workspaceId);
  if (!workspace) {
    throw new NotFoundException("Workspace not found");
  }

  const member = await MemberModel.findOne({
    userId,
    workspaceId,
    status: { $ne: "DEACTIVATED" },
  }).populate("role");

  if (!member) {
    throw new UnauthorizedException(
      "You are not a member of this workspace",
      ErrorCodeEnum.ACCESS_UNAUTHORIZED
    );
  }

  const role = member.role;
  const roleName = role?.name;
  const permissions = (role?.permissions || []) as PermissionType[];
  const authorizationRole =
    role?.isSystem || Object.values(Roles).includes(roleName as keyof typeof Roles)
      ? roleName
      : `CUSTOM:${role?._id.toString()}`;

  if (authorizationRole) {
    (RolePermissions as Record<string, PermissionType[]>)[authorizationRole] =
      permissions;
  }

  await MemberModel.updateOne(
    { _id: member._id },
    { $set: { lastActiveAt: new Date() } }
  );

  return {
    role: authorizationRole,
    roleName,
    permissions,
    memberId: member._id.toString(),
    isSystemRole: Boolean(role?.isSystem),
  };
};

export const joinWorkspaceByInviteService = async (
  userId: string,
  inviteCode: string
) => {
  // Find workspace by invite code
  const workspace = await WorkspaceModel.findOne({ inviteCode }).exec();
  if (!workspace) {
    throw new NotFoundException("Invalid invite code or workspace not found");
  }

  const policy = await getOrCreateWorkspacePolicy(workspace._id.toString());
  if (!policy.members.allowSelfInvite) {
    throw new BadRequestException("Invite-code joins are disabled for this workspace");
  }

  // Check if user is already a member
  const existingMember = await MemberModel.findOne({
    userId,
    workspaceId: workspace._id,
  }).exec();

  if (existingMember) {
    throw new BadRequestException("You are already a member of this workspace");
  }

  const role = await RoleModel.findOne({ name: Roles.MEMBER, isSystem: true });

  if (!role) {
    throw new NotFoundException("Role not found");
  }

  // Add user to workspace as a member
  const newMember = new MemberModel({
    userId,
    workspaceId: workspace._id,
    role: role._id,
  });

  try {
    await newMember.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new BadRequestException("You are already a member of this workspace");
    }

    throw error;
  }

  return { workspaceId: workspace._id, role: role.name, memberId: newMember._id };
};

const getManagedMemberOrThrow = async (workspaceId: string, memberId: string) => {
  const member = await MemberModel.findOne({
    _id: memberId,
    workspaceId,
  }).populate("role");

  if (!member) {
    throw new NotFoundException("Member not found");
  }

  return member;
};

const assertCanManageMember = async (
  context: RequestContext,
  targetMemberId: string
) => {
  const access = await assertOwnerOrAdmin(context.workspaceId, context.userId);
  const target = await getManagedMemberOrThrow(
    context.workspaceId,
    targetMemberId
  );
  const targetRole = target.role as unknown as { name: string; isSystem: boolean };

  if (targetRole.isSystem && targetRole.name === Roles.OWNER) {
    throw new BadRequestException("Workspace owner cannot be modified here");
  }

  if (
    access.isAdmin &&
    targetRole.isSystem &&
    (targetRole.name === Roles.ADMIN || targetRole.name === Roles.OWNER)
  ) {
    throw new BadRequestException("Admins cannot manage owners or admins");
  }

  return { access, target, targetRole };
};

export const deactivateMemberService = async (
  context: RequestContext,
  memberId: string
) => {
  const { target, targetRole } = await assertCanManageMember(context, memberId);

  target.status = "DEACTIVATED";
  target.deactivatedAt = new Date();
  target.deactivatedBy = new mongoose.Types.ObjectId(context.userId);
  await target.save();

  await recordAuditLog(context, {
    action: AuditActionEnum.UPDATED,
    entityType: DomainEntityTypeEnum.MEMBER,
    entityId: target._id.toString(),
    before: { status: "ACTIVE", roleName: targetRole.name },
    after: { status: "DEACTIVATED", roleName: targetRole.name },
  });

  return { member: target };
};

export const removeMemberService = async (
  context: RequestContext,
  memberId: string
) => {
  const { target, targetRole } = await assertCanManageMember(context, memberId);
  const targetUserId = target.userId;

  await target.deleteOne();

  const replacement = await MemberModel.findOne({
    userId: targetUserId,
    status: { $ne: "DEACTIVATED" },
  }).select("workspaceId");

  await UserModel.updateOne(
    { _id: targetUserId, currentWorkspace: context.workspaceId },
    { $set: { currentWorkspace: replacement?.workspaceId || null } }
  );

  await recordAuditLog(context, {
    action: AuditActionEnum.DELETED,
    entityType: DomainEntityTypeEnum.MEMBER,
    entityId: memberId,
    before: {
      userId: targetUserId.toString(),
      roleName: targetRole.name,
    },
  });
};

export const bulkDeactivateMembersService = async (
  context: RequestContext,
  memberIds: string[]
) => {
  for (const memberId of memberIds) {
    await deactivateMemberService(context, memberId);
  }
};

export const bulkRemoveMembersService = async (
  context: RequestContext,
  memberIds: string[]
) => {
  for (const memberId of memberIds) {
    await removeMemberService(context, memberId);
  }
};

export const bulkAssignMemberRoleService = async (
  context: RequestContext,
  memberIds: string[],
  roleId: string
) => {
  const access = await assertOwnerOrAdmin(context.workspaceId, context.userId);
  if (!access.isOwner) {
    throw new BadRequestException("Only owners can change member roles");
  }

  const role = await getAssignableRoleOrThrow(context.workspaceId, roleId);
  if (role.isSystem && role.name === Roles.OWNER) {
    throw new BadRequestException("Workspace ownership cannot be assigned here");
  }

  for (const memberId of memberIds) {
    const { target, targetRole } = await assertCanManageMember(context, memberId);
    const before = { roleId: target.role?._id?.toString(), roleName: targetRole.name };
    target.role = role;
    await target.save();

    await recordAuditLog(context, {
      action: AuditActionEnum.PERMISSION_CHANGED,
      entityType: DomainEntityTypeEnum.MEMBER,
      entityId: target._id.toString(),
      before,
      after: { roleId: role._id.toString(), roleName: role.name },
    });
  }
};
