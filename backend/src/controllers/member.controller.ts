import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { z } from "zod";
import { HTTPSTATUS } from "../config/http.config";
import { DomainEntityTypeEnum, DomainEventTypeEnum } from "../enums/domain.enum";
import { joinWorkspaceByInviteService } from "../services/member.service";
import {
  bulkAssignMemberRoleService,
  bulkDeactivateMembersService,
  bulkRemoveMembersService,
  deactivateMemberService,
  removeMemberService,
} from "../services/member.service";
import { emitDomainEvent } from "../services/domain-event.service";
import { buildRequestContext } from "../utils/request-context";
import {
  bulkMemberActionSchema,
  bulkRoleChangeSchema,
  memberIdSchema,
} from "../validation/governance.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

const inviteCodeSchema = z.string().trim().regex(/^[a-f0-9]{8}$/i);

export const joinWorkspaceController = asyncHandler(
  async (req: Request, res: Response) => {
    const inviteCode = inviteCodeSchema.parse(req.params.inviteCode);
    const userId = req.user?._id;

    const { workspaceId, role, memberId } = await joinWorkspaceByInviteService(
      userId,
      inviteCode
    );
    const context = buildRequestContext(req, workspaceId.toString());

    await emitDomainEvent({
      type: DomainEventTypeEnum.MEMBER_JOINED,
      context,
      entityType: DomainEntityTypeEnum.MEMBER,
      entityId: memberId.toString(),
      target: {
        type: DomainEntityTypeEnum.WORKSPACE,
        id: workspaceId.toString(),
      },
      metadata: {
        joinedUserId: userId?.toString(),
        inviteAccepted: true,
      },
      occurredAt: new Date(),
    });

    return res.status(HTTPSTATUS.OK).json({
      message: "Successfully joined the workspace",
      workspaceId,
      role,
    });
  }
);

export const deactivateMemberController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const memberId = memberIdSchema.parse(req.params.memberId);
    const context = buildRequestContext(req, workspaceId);

    await deactivateMemberService(context, memberId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Member deactivated successfully",
    });
  }
);

export const removeMemberController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const memberId = memberIdSchema.parse(req.params.memberId);
    const context = buildRequestContext(req, workspaceId);

    await removeMemberService(context, memberId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Member removed successfully",
    });
  }
);

export const bulkDeactivateMembersController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const { memberIds } = bulkMemberActionSchema.parse(req.body);
    const context = buildRequestContext(req, workspaceId);

    await bulkDeactivateMembersService(context, memberIds);

    return res.status(HTTPSTATUS.OK).json({
      message: "Members deactivated successfully",
    });
  }
);

export const bulkRemoveMembersController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const { memberIds } = bulkMemberActionSchema.parse(req.body);
    const context = buildRequestContext(req, workspaceId);

    await bulkRemoveMembersService(context, memberIds);

    return res.status(HTTPSTATUS.OK).json({
      message: "Members removed successfully",
    });
  }
);

export const bulkAssignMemberRoleController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const { memberIds, roleId } = bulkRoleChangeSchema.parse(req.body);
    const context = buildRequestContext(req, workspaceId);

    await bulkAssignMemberRoleService(context, memberIds, roleId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Members roles updated successfully",
    });
  }
);
