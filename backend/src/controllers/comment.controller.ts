import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { Permissions } from "../enums/role.enum";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { getMemberRoleInWorkspace } from "../services/member.service";
import {
  createCommentReplyService,
  createCommentService,
  deleteCommentService,
  getCommentRepliesService,
  getCommentsForTargetService,
  updateCommentService,
} from "../services/comment.service";
import { buildRequestContext } from "../utils/request-context";
import { roleGuard } from "../utils/roleGuard";
import {
  commentBodySchema,
  commentIdSchema,
  commentListQuerySchema,
  commentTargetIdSchema,
  commentTargetTypeSchema,
} from "../validation/comment.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

export const getCommentsForTargetController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const targetType = commentTargetTypeSchema.parse(req.params.targetType);
    const targetId = commentTargetIdSchema.parse(req.params.targetId);
    const pagination = commentListQuerySchema.parse(req.query);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await getCommentsForTargetService(
      workspaceId,
      targetType,
      targetId,
      pagination
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Comments fetched successfully",
      ...result,
    });
  }
);

export const getCommentRepliesController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const commentId = commentIdSchema.parse(req.params.commentId);
    const pagination = commentListQuerySchema.parse(req.query);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await getCommentRepliesService(
      workspaceId,
      commentId,
      pagination
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Replies fetched successfully",
      ...result,
    });
  }
);

export const createCommentController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const targetType = commentTargetTypeSchema.parse(req.params.targetType);
    const targetId = commentTargetIdSchema.parse(req.params.targetId);
    const body = commentBodySchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.CREATE_COMMENT]);

    const context = buildRequestContext(req, workspaceId);
    const result = await createCommentService(context, targetType, targetId, body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Comment created successfully",
      ...result,
    });
  }
);

export const createCommentReplyController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const commentId = commentIdSchema.parse(req.params.commentId);
    const body = commentBodySchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.CREATE_COMMENT]);

    const context = buildRequestContext(req, workspaceId);
    const result = await createCommentReplyService(context, commentId, body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Reply created successfully",
      ...result,
    });
  }
);

export const updateCommentController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const commentId = commentIdSchema.parse(req.params.commentId);
    const body = commentBodySchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.EDIT_COMMENT]);

    const context = buildRequestContext(req, workspaceId);
    const result = await updateCommentService(context, commentId, body);

    return res.status(HTTPSTATUS.OK).json({
      message: "Comment updated successfully",
      ...result,
    });
  }
);

export const deleteCommentController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const commentId = commentIdSchema.parse(req.params.commentId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.DELETE_COMMENT]);

    const context = buildRequestContext(req, workspaceId);
    await deleteCommentService(context, commentId, role);

    return res.status(HTTPSTATUS.OK).json({
      message: "Comment deleted successfully",
    });
  }
);
