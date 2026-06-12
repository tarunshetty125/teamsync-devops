import mongoose from "mongoose";
import {
  ActivityTypeEnum,
  AuditActionEnum,
  CommentTargetType,
  CommentTargetTypeEnum,
  DomainEntityTypeEnum,
  DomainEventTypeEnum,
} from "../enums/domain.enum";
import { Roles } from "../enums/role.enum";
import CommentModel, { CommentDocument } from "../models/comment.model";
import MemberModel from "../models/member.model";
import MentionModel from "../models/mention.model";
import ProjectModel from "../models/project.model";
import TaskModel from "../models/task.model";
import { RequestContext } from "../types/request-context";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "../utils/appError";
import { recordActivity } from "./activity.service";
import { recordAuditLog } from "./audit-log.service";
import { emitDomainEvent } from "./domain-event.service";
import { getOrCreateWorkspacePolicy } from "./workspace-policy.service";

type CommentBodyInput = {
  bodyJson: unknown;
  plainText: string;
};

type PaginationInput = {
  pageSize: number;
  pageNumber: number;
};

type LeanComment = {
  _id: mongoose.Types.ObjectId;
  workspace: mongoose.Types.ObjectId;
  author:
    | mongoose.Types.ObjectId
    | {
        _id: mongoose.Types.ObjectId;
        name?: string;
        email?: string;
        profilePicture?: string | null;
      };
  targetType: CommentTargetType;
  targetId: mongoose.Types.ObjectId;
  parentComment?: mongoose.Types.ObjectId | null;
  bodyJson: Record<string, unknown>;
  plainText: string;
  mentions: mongoose.Types.ObjectId[];
  editedAt?: Date | null;
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  replyCount?: number;
  replies?: LeanComment[];
};

type SerializedComment = Omit<
  LeanComment,
  "_id" | "workspace" | "author" | "targetId" | "parentComment" | "mentions" | "deletedBy" | "replies"
> & {
  _id: string;
  workspace: string;
  author:
    | string
    | {
        _id: string;
        name?: string;
        email?: string;
        profilePicture: string | null;
      };
  targetId: string;
  parentComment: string | null;
  mentions: string[];
  deletedBy: string | null;
  replies: SerializedComment[];
};

const COMMENT_AUTHOR_SELECT = "_id name email profilePicture";

const getObjectId = (value: mongoose.Types.ObjectId | string) =>
  new mongoose.Types.ObjectId(value);

const getDocumentId = (document: CommentDocument) =>
  (document._id as mongoose.Types.ObjectId).toString();

const isPopulatedAuthor = (
  author: LeanComment["author"]
): author is Exclude<LeanComment["author"], mongoose.Types.ObjectId> =>
  typeof author === "object" &&
  author !== null &&
  "_id" in author &&
  !(author instanceof mongoose.Types.ObjectId);

const extractMentionIds = (value: unknown, found = new Set<string>()) => {
  if (!value || typeof value !== "object") {
    return found;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => extractMentionIds(item, found));
    return found;
  }

  const node = value as Record<string, unknown>;
  if (node.type === "mention") {
    const attrs = node.attrs as Record<string, unknown> | undefined;
    if (typeof attrs?.id === "string" && mongoose.Types.ObjectId.isValid(attrs.id)) {
      found.add(attrs.id);
    }
  }

  if (Array.isArray(node.content)) {
    node.content.forEach((item) => extractMentionIds(item, found));
  }

  return found;
};

const ensureMentionedUsersAreWorkspaceMembers = async (
  workspaceId: string,
  mentionIds: string[]
) => {
  if (mentionIds.length === 0) {
    return;
  }

  const memberUserIds = await MemberModel.find({
    workspaceId,
    userId: { $in: mentionIds },
  }).distinct("userId");

  const memberSet = new Set(memberUserIds.map((id) => id.toString()));
  const missingUser = mentionIds.find((id) => !memberSet.has(id));

  if (missingUser) {
    throw new BadRequestException(
      "Mentioned users must belong to the comment workspace"
    );
  }
};

const syncMentionRecords = async (
  context: RequestContext,
  comment: CommentDocument,
  mentionIds: string[]
) => {
  const commentId = getDocumentId(comment);

  await MentionModel.deleteMany({
    workspace: context.workspaceId,
    sourceType: DomainEntityTypeEnum.COMMENT,
    sourceId: comment._id,
  });

  if (mentionIds.length === 0) {
    return;
  }

  await MentionModel.insertMany(
    mentionIds.map((mentionedUser) => ({
      workspace: context.workspaceId,
      mentionedUser,
      mentionedBy: context.userId,
      sourceType: DomainEntityTypeEnum.COMMENT,
      sourceId: commentId,
      targetType: comment.targetType,
      targetId: comment.targetId,
    }))
  );
};

const ensureTargetInWorkspace = async (
  workspaceId: string,
  targetType: CommentTargetType,
  targetId: string
) => {
  if (targetType === CommentTargetTypeEnum.TASK) {
    const task = await TaskModel.findOne({
      _id: targetId,
      workspace: workspaceId,
    }).select("_id title project");

    if (!task) {
      throw new NotFoundException(
        "Task not found or does not belong to this workspace"
      );
    }

    return {
      target: task,
      projectId: task.project?.toString() ?? null,
      taskId: task._id.toString(),
    };
  }

  const project = await ProjectModel.findOne({
    _id: targetId,
    workspace: workspaceId,
  }).select("_id name");

  if (!project) {
    throw new NotFoundException(
      "Project not found or does not belong to this workspace"
    );
  }

  return {
    target: project,
    projectId: project._id.toString(),
    taskId: null,
  };
};

const serializeComment = (comment: LeanComment): SerializedComment => ({
  ...comment,
  _id: comment._id.toString(),
  workspace: comment.workspace.toString(),
  targetId: comment.targetId.toString(),
  parentComment: comment.parentComment?.toString() ?? null,
  mentions: comment.mentions.map((mention) => mention.toString()),
  deletedBy: comment.deletedBy?.toString() ?? null,
  author: isPopulatedAuthor(comment.author)
      ? {
          _id: comment.author._id.toString(),
          name: comment.author.name,
          email: comment.author.email,
          profilePicture: comment.author.profilePicture ?? null,
        }
      : comment.author.toString(),
  replies: comment.replies?.map(serializeComment) ?? [],
});

const getCommentOrThrow = async (workspaceId: string, commentId: string) => {
  const comment = await CommentModel.findOne({
    _id: commentId,
    workspace: workspaceId,
    deletedAt: null,
  });

  if (!comment) {
    throw new NotFoundException("Comment not found");
  }

  return comment;
};

const canDeleteComment = (
  comment: CommentDocument,
  context: RequestContext,
  role: string
) =>
  comment.author.toString() === context.userId ||
  role === Roles.OWNER ||
  role === Roles.ADMIN;

export const getCommentsForTargetService = async (
  workspaceId: string,
  targetType: CommentTargetType,
  targetId: string,
  pagination: PaginationInput
) => {
  await ensureTargetInWorkspace(workspaceId, targetType, targetId);

  const { pageSize, pageNumber } = pagination;
  const skip = (pageNumber - 1) * pageSize;
  const query = {
    workspace: getObjectId(workspaceId),
    targetType,
    targetId: getObjectId(targetId),
    parentComment: null,
    deletedAt: null,
  };

  const [comments, totalCount] = await Promise.all([
    CommentModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate("author", COMMENT_AUTHOR_SELECT)
      .lean<LeanComment[]>(),
    CommentModel.countDocuments(query),
  ]);

  const commentsWithReplies = await Promise.all(
    comments.map(async (comment) => {
      const replyQuery = {
        workspace: getObjectId(workspaceId),
        parentComment: comment._id,
        deletedAt: null,
      };

      const [replyCount, replies] = await Promise.all([
        CommentModel.countDocuments(replyQuery),
        CommentModel.find(replyQuery)
          .sort({ createdAt: 1 })
          .limit(3)
          .populate("author", COMMENT_AUTHOR_SELECT)
          .lean<LeanComment[]>(),
      ]);

      return {
        ...comment,
        replyCount,
        replies,
      };
    })
  );

  return {
    comments: commentsWithReplies.map(serializeComment),
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      skip,
      limit: pageSize,
    },
  };
};

export const getCommentRepliesService = async (
  workspaceId: string,
  commentId: string,
  pagination: PaginationInput
) => {
  const parentComment = await getCommentOrThrow(workspaceId, commentId);

  if (parentComment.parentComment) {
    throw new BadRequestException("Replies cannot have nested replies");
  }

  const { pageSize, pageNumber } = pagination;
  const skip = (pageNumber - 1) * pageSize;
  const query = {
    workspace: getObjectId(workspaceId),
    parentComment: parentComment._id,
    deletedAt: null,
  };

  const [replies, totalCount] = await Promise.all([
    CommentModel.find(query)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(pageSize)
      .populate("author", COMMENT_AUTHOR_SELECT)
      .lean<LeanComment[]>(),
    CommentModel.countDocuments(query),
  ]);

  return {
    replies: replies.map(serializeComment),
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      skip,
      limit: pageSize,
    },
  };
};

export const createCommentService = async (
  context: RequestContext,
  targetType: CommentTargetType,
  targetId: string,
  body: CommentBodyInput
) => {
  const target = await ensureTargetInWorkspace(
    context.workspaceId,
    targetType,
    targetId
  );
  const mentionIds = Array.from(extractMentionIds(body.bodyJson));
  await ensureMentionedUsersAreWorkspaceMembers(context.workspaceId, mentionIds);

  const comment = await CommentModel.create({
    workspace: context.workspaceId,
    author: context.userId,
    targetType,
    targetId,
    parentComment: null,
    bodyJson: body.bodyJson,
    plainText: body.plainText,
    mentions: mentionIds,
  });

  await syncMentionRecords(context, comment, mentionIds);

  await Promise.all([
    recordActivity(context, {
      type: ActivityTypeEnum.COMMENT_CREATED,
      entityType: DomainEntityTypeEnum.COMMENT,
      entityId: getDocumentId(comment),
      projectId: target.projectId,
      taskId: target.taskId,
      summary: "Comment added",
      metadata: { targetType, targetId },
    }),
    recordAuditLog(context, {
      action: AuditActionEnum.CREATED,
      entityType: DomainEntityTypeEnum.COMMENT,
      entityId: getDocumentId(comment),
      after: {
        targetType,
        targetId,
        plainText: body.plainText,
        mentions: mentionIds,
      },
    }),
    emitDomainEvent({
      type: DomainEventTypeEnum.COMMENT_CREATED,
      context,
      entityType: DomainEntityTypeEnum.COMMENT,
      entityId: getDocumentId(comment),
      target: { type: DomainEntityTypeEnum.COMMENT, id: getDocumentId(comment) },
      metadata: { targetType, targetId, mentionIds },
      occurredAt: new Date(),
    }),
  ]);

  const populated = await CommentModel.findById(comment._id)
    .populate("author", COMMENT_AUTHOR_SELECT)
    .lean<LeanComment>();

  return { comment: serializeComment({ ...populated!, replyCount: 0, replies: [] }) };
};

export const createCommentReplyService = async (
  context: RequestContext,
  parentCommentId: string,
  body: CommentBodyInput
) => {
  const parentComment = await getCommentOrThrow(context.workspaceId, parentCommentId);

  if (parentComment.parentComment) {
    throw new BadRequestException("Replies cannot have nested replies");
  }

  const mentionIds = Array.from(extractMentionIds(body.bodyJson));
  await ensureMentionedUsersAreWorkspaceMembers(context.workspaceId, mentionIds);

  const comment = await CommentModel.create({
    workspace: context.workspaceId,
    author: context.userId,
    targetType: parentComment.targetType,
    targetId: parentComment.targetId,
    parentComment: parentComment._id,
    bodyJson: body.bodyJson,
    plainText: body.plainText,
    mentions: mentionIds,
  });

  await syncMentionRecords(context, comment, mentionIds);

  const target =
    parentComment.targetType === CommentTargetTypeEnum.TASK
      ? await ensureTargetInWorkspace(
          context.workspaceId,
          parentComment.targetType,
          parentComment.targetId.toString()
        )
      : {
          projectId: parentComment.targetId.toString(),
          taskId: null,
        };

  await Promise.all([
    recordActivity(context, {
      type: ActivityTypeEnum.COMMENT_CREATED,
      entityType: DomainEntityTypeEnum.COMMENT,
      entityId: getDocumentId(comment),
      projectId: target.projectId,
      taskId: target.taskId,
      summary: "Reply added",
      metadata: {
        parentCommentId,
        targetType: parentComment.targetType,
        targetId: parentComment.targetId.toString(),
      },
    }),
    recordAuditLog(context, {
      action: AuditActionEnum.CREATED,
      entityType: DomainEntityTypeEnum.COMMENT,
      entityId: getDocumentId(comment),
      after: {
        parentCommentId,
        plainText: body.plainText,
        mentions: mentionIds,
      },
    }),
    emitDomainEvent({
      type: DomainEventTypeEnum.COMMENT_CREATED,
      context,
      entityType: DomainEntityTypeEnum.COMMENT,
      entityId: getDocumentId(comment),
      target: { type: DomainEntityTypeEnum.COMMENT, id: getDocumentId(comment) },
      metadata: { parentCommentId, mentionIds },
      occurredAt: new Date(),
    }),
  ]);

  const populated = await CommentModel.findById(comment._id)
    .populate("author", COMMENT_AUTHOR_SELECT)
    .lean<LeanComment>();

  return { reply: serializeComment({ ...populated!, replyCount: 0, replies: [] }) };
};

export const updateCommentService = async (
  context: RequestContext,
  commentId: string,
  body: CommentBodyInput
) => {
  const comment = await getCommentOrThrow(context.workspaceId, commentId);
  const policy = await getOrCreateWorkspacePolicy(context.workspaceId);

  if (!policy.comments.allowEdit) {
    throw new ForbiddenException("Comment editing is disabled by workspace policy");
  }

  if (comment.author.toString() !== context.userId) {
    throw new ForbiddenException("Only the comment author can edit this comment");
  }

  const before = {
    plainText: comment.plainText,
    mentions: comment.mentions.map((mention) => mention.toString()),
  };
  const mentionIds = Array.from(extractMentionIds(body.bodyJson));
  const newMentionIds = mentionIds.filter(
    (mentionId) => !before.mentions.includes(mentionId)
  );
  await ensureMentionedUsersAreWorkspaceMembers(context.workspaceId, mentionIds);
  const target = await ensureTargetInWorkspace(
    context.workspaceId,
    comment.targetType,
    comment.targetId.toString()
  );

  comment.bodyJson = body.bodyJson as Record<string, unknown>;
  comment.plainText = body.plainText;
  comment.mentions = mentionIds.map((id) => getObjectId(id));
  comment.editedAt = new Date();
  await comment.save();

  await syncMentionRecords(context, comment, mentionIds);

  await Promise.all([
    recordActivity(context, {
      type: ActivityTypeEnum.COMMENT_UPDATED,
      entityType: DomainEntityTypeEnum.COMMENT,
      entityId: getDocumentId(comment),
      projectId: target.projectId,
      taskId: target.taskId,
      summary: "Comment edited",
      metadata: {
        targetType: comment.targetType,
        targetId: comment.targetId.toString(),
      },
    }),
    recordAuditLog(context, {
      action: AuditActionEnum.UPDATED,
      entityType: DomainEntityTypeEnum.COMMENT,
      entityId: getDocumentId(comment),
      before,
      after: { plainText: body.plainText, mentions: mentionIds },
    }),
    emitDomainEvent({
      type: DomainEventTypeEnum.COMMENT_UPDATED,
      context,
      entityType: DomainEntityTypeEnum.COMMENT,
      entityId: getDocumentId(comment),
      target: { type: DomainEntityTypeEnum.COMMENT, id: getDocumentId(comment) },
      metadata: {
        targetType: comment.targetType,
        targetId: comment.targetId.toString(),
        mentionIds,
        newMentionIds,
      },
      occurredAt: new Date(),
    }),
  ]);

  const populated = await CommentModel.findById(comment._id)
    .populate("author", COMMENT_AUTHOR_SELECT)
    .lean<LeanComment>();

  return { comment: serializeComment({ ...populated!, replyCount: 0, replies: [] }) };
};

export const deleteCommentService = async (
  context: RequestContext,
  commentId: string,
  role: string
) => {
  const comment = await getCommentOrThrow(context.workspaceId, commentId);
  const policy = await getOrCreateWorkspacePolicy(context.workspaceId);

  if (
    !policy.comments.allowDelete &&
    comment.author.toString() === context.userId
  ) {
    throw new ForbiddenException("Comment deletion is disabled by workspace policy");
  }

  if (!canDeleteComment(comment, context, role)) {
    throw new ForbiddenException("Only authors, owners, or admins can delete comments");
  }

  const target = await ensureTargetInWorkspace(
    context.workspaceId,
    comment.targetType,
    comment.targetId.toString()
  );

  comment.deletedAt = new Date();
  comment.deletedBy = getObjectId(context.userId);
  await comment.save();

  await MentionModel.deleteMany({
    workspace: context.workspaceId,
    sourceType: DomainEntityTypeEnum.COMMENT,
    sourceId: comment._id,
  });

  await Promise.all([
    recordActivity(context, {
      type: ActivityTypeEnum.COMMENT_DELETED,
      entityType: DomainEntityTypeEnum.COMMENT,
      entityId: getDocumentId(comment),
      projectId: target.projectId,
      taskId: target.taskId,
      summary: "Comment deleted",
      metadata: {
        targetType: comment.targetType,
        targetId: comment.targetId.toString(),
      },
    }),
    recordAuditLog(context, {
      action: AuditActionEnum.DELETED,
      entityType: DomainEntityTypeEnum.COMMENT,
      entityId: getDocumentId(comment),
      before: {
        plainText: comment.plainText,
        mentions: comment.mentions.map((mention) => mention.toString()),
      },
    }),
    emitDomainEvent({
      type: DomainEventTypeEnum.COMMENT_DELETED,
      context,
      entityType: DomainEntityTypeEnum.COMMENT,
      entityId: getDocumentId(comment),
      target: { type: DomainEntityTypeEnum.COMMENT, id: getDocumentId(comment) },
      metadata: {
        targetType: comment.targetType,
        targetId: comment.targetId.toString(),
      },
      occurredAt: new Date(),
    }),
  ]);
};
