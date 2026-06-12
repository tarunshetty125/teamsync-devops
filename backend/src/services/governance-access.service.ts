import { Roles } from "../enums/role.enum";
import MemberModel from "../models/member.model";
import RoleModel from "../models/roles-permission.model";
import WorkspaceModel from "../models/workspace.model";
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "../utils/appError";

export const getGovernanceAccess = async (
  workspaceId: string,
  userId: string
) => {
  const [workspace, member] = await Promise.all([
    WorkspaceModel.findById(workspaceId).select("_id owner"),
    MemberModel.findOne({
      workspaceId,
      userId,
      status: { $ne: "DEACTIVATED" },
    }).populate("role"),
  ]);

  if (!workspace) {
    throw new NotFoundException("Workspace not found");
  }

  if (!member) {
    throw new UnauthorizedException("You are not a member of this workspace");
  }

  const role = member.role as unknown as {
    _id: unknown;
    name: string;
    permissions: string[];
    isSystem: boolean;
  };

  return {
    workspace,
    member,
    role,
    roleName: role.name,
    isOwner: role.isSystem && role.name === Roles.OWNER,
    isAdmin: role.isSystem && role.name === Roles.ADMIN,
  };
};

export const assertOwner = async (workspaceId: string, userId: string) => {
  const access = await getGovernanceAccess(workspaceId, userId);

  if (!access.isOwner) {
    throw new ForbiddenException("Only workspace owners can perform this action");
  }

  return access;
};

export const assertOwnerOrAdmin = async (
  workspaceId: string,
  userId: string
) => {
  const access = await getGovernanceAccess(workspaceId, userId);

  if (!access.isOwner && !access.isAdmin) {
    throw new ForbiddenException(
      "Only workspace owners and admins can perform this action"
    );
  }

  return access;
};

export const getAssignableRoleOrThrow = async (
  workspaceId: string,
  roleId: string
) => {
  const role = await RoleModel.findOne({
    _id: roleId,
    deletedAt: null,
    $or: [{ workspace: null, isSystem: true }, { workspace: workspaceId }],
  });

  if (!role) {
    throw new NotFoundException("Role not found");
  }

  return role;
};
