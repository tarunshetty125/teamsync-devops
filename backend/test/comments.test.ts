import { describe, expect, it } from "vitest";
import ActivityModel from "../src/models/activity.model";
import AuditLogModel from "../src/models/audit-log.model";
import CommentModel from "../src/models/comment.model";
import MemberModel from "../src/models/member.model";
import MentionModel from "../src/models/mention.model";
import RoleModel from "../src/models/roles-permission.model";
import TaskModel from "../src/models/task.model";
import WorkspaceModel from "../src/models/workspace.model";
import { Roles } from "../src/enums/role.enum";
import {
  CommentTargetTypeEnum,
  DomainEventTypeEnum,
} from "../src/enums/domain.enum";
import { registerUserService } from "../src/services/auth.service";
import {
  createCommentReplyService,
  createCommentService,
  deleteCommentService,
  getCommentsForTargetService,
  updateCommentService,
} from "../src/services/comment.service";
import {
  clearDomainEventHandlersForTest,
  registerDomainEventHandler,
} from "../src/services/domain-event.service";
import { createProjectService } from "../src/services/project.service";
import { createTaskService } from "../src/services/task.service";
import { RequestContext } from "../src/types/request-context";

const password = "Str0ng!Pass";

const tiptapDoc = (text: string, mentionUserId?: string) => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: mentionUserId
        ? [
            { type: "text", text },
            {
              type: "mention",
              attrs: {
                id: mentionUserId,
                label: "Mentioned User",
              },
            },
          ]
        : [{ type: "text", text }],
    },
  ],
});

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
    name: "Comment Project",
    description: "Project with comments",
  });

  const { task } = await createTaskService(
    owner.workspaceId,
    project._id.toString(),
    owner.userId,
    {
      title: "Comment Task",
      description: "Task with comments",
      priority: "MEDIUM",
      status: "TODO",
    }
  );

  return { project, task };
};

describe("comment collaboration services", () => {
  it("creates task comments with workspace-scoped mentions, audit, activity, and domain events", async () => {
    const owner = await registerUser("comment-owner@example.com", "Owner");
    const mentioned = await registerUser("comment-mentioned@example.com", "Mentioned");
    await addMemberToWorkspace(mentioned.userId, owner.workspaceId);
    const { task } = await createTaskTarget(owner);

    let handlerCalled = false;
    registerDomainEventHandler(DomainEventTypeEnum.COMMENT_CREATED, () => {
      handlerCalled = true;
      throw new Error("handler failure should be isolated");
    });

    const { comment } = await createCommentService(
      makeContext(owner.userId, owner.workspaceId),
      CommentTargetTypeEnum.TASK,
      task._id.toString(),
      {
        bodyJson: tiptapDoc("Hello ", mentioned.userId),
        plainText: "Hello Mentioned User",
      }
    );

    expect(comment._id).toBeTruthy();
    expect(comment.workspace).toBe(owner.workspaceId);
    expect(comment.mentions).toEqual([mentioned.userId]);
    expect(handlerCalled).toBe(true);
    expect(await MentionModel.countDocuments({ sourceId: comment._id })).toBe(1);
    expect(await ActivityModel.countDocuments({ entityId: comment._id })).toBe(1);
    expect(await AuditLogModel.countDocuments({ entityId: comment._id })).toBe(1);

    clearDomainEventHandlersForTest();
  });

  it("rejects comments on targets from another workspace", async () => {
    const owner = await registerUser("comment-cross-owner@example.com", "Owner");
    const outsider = await registerUser(
      "comment-cross-outsider@example.com",
      "Outsider"
    );
    const { task } = await createTaskTarget(owner);

    await expect(
      createCommentService(
        makeContext(outsider.userId, outsider.workspaceId),
        CommentTargetTypeEnum.TASK,
        task._id.toString(),
        {
          bodyJson: tiptapDoc("Not allowed"),
          plainText: "Not allowed",
        }
      )
    ).rejects.toThrow(/does not belong to this workspace/i);
  });

  it("supports one-level replies and blocks nested replies", async () => {
    const owner = await registerUser("reply-owner@example.com", "Owner");
    const { task } = await createTaskTarget(owner);
    const context = makeContext(owner.userId, owner.workspaceId);

    const { comment } = await createCommentService(
      context,
      CommentTargetTypeEnum.TASK,
      task._id.toString(),
      {
        bodyJson: tiptapDoc("Parent"),
        plainText: "Parent",
      }
    );

    const { reply } = await createCommentReplyService(context, comment._id, {
      bodyJson: tiptapDoc("Reply"),
      plainText: "Reply",
    });

    await expect(
      createCommentReplyService(context, reply._id, {
        bodyJson: tiptapDoc("Nested"),
        plainText: "Nested",
      })
    ).rejects.toThrow(/nested replies/i);

    const result = await getCommentsForTargetService(
      owner.workspaceId,
      CommentTargetTypeEnum.TASK,
      task._id.toString(),
      { pageSize: 20, pageNumber: 1 }
    );
    expect(result.comments[0].replyCount).toBe(1);
    expect(result.comments[0].replies[0]._id).toBe(reply._id);
  });

  it("allows authors to edit their own comments and blocks edits by other members", async () => {
    const owner = await registerUser("edit-owner@example.com", "Owner");
    const member = await registerUser("edit-member@example.com", "Member");
    await addMemberToWorkspace(member.userId, owner.workspaceId);
    const { task } = await createTaskTarget(owner);

    const { comment } = await createCommentService(
      makeContext(owner.userId, owner.workspaceId),
      CommentTargetTypeEnum.TASK,
      task._id.toString(),
      {
        bodyJson: tiptapDoc("Original"),
        plainText: "Original",
      }
    );

    await expect(
      updateCommentService(makeContext(member.userId, owner.workspaceId), comment._id, {
        bodyJson: tiptapDoc("Member edit"),
        plainText: "Member edit",
      })
    ).rejects.toThrow(/author can edit/i);

    const { comment: edited } = await updateCommentService(
      makeContext(owner.userId, owner.workspaceId),
      comment._id,
      {
        bodyJson: tiptapDoc("Edited"),
        plainText: "Edited",
      }
    );

    expect(edited.plainText).toBe("Edited");
    expect(edited.editedAt).toBeTruthy();
  });

  it("soft deletes comments and lets owners delete member comments", async () => {
    const owner = await registerUser("delete-owner@example.com", "Owner");
    const member = await registerUser("delete-member@example.com", "Member");
    await addMemberToWorkspace(member.userId, owner.workspaceId);
    const { task } = await createTaskTarget(owner);

    const { comment } = await createCommentService(
      makeContext(member.userId, owner.workspaceId),
      CommentTargetTypeEnum.TASK,
      task._id.toString(),
      {
        bodyJson: tiptapDoc("Member comment"),
        plainText: "Member comment",
      }
    );

    await deleteCommentService(
      makeContext(owner.userId, owner.workspaceId),
      comment._id,
      Roles.OWNER
    );

    const deleted = await CommentModel.findById(comment._id);
    expect(deleted?.deletedAt).toBeTruthy();
    expect(deleted?.deletedBy?.toString()).toBe(owner.userId);
    expect(await MentionModel.countDocuments({ sourceId: comment._id })).toBe(0);

    const result = await getCommentsForTargetService(
      owner.workspaceId,
      CommentTargetTypeEnum.TASK,
      task._id.toString(),
      { pageSize: 20, pageNumber: 1 }
    );
    expect(result.comments).toHaveLength(0);
  });

  it("rejects mentions for users outside the workspace", async () => {
    const owner = await registerUser("mention-owner@example.com", "Owner");
    const outsider = await registerUser("mention-outsider@example.com", "Outsider");
    const { task } = await createTaskTarget(owner);

    await expect(
      createCommentService(
        makeContext(owner.userId, owner.workspaceId),
        CommentTargetTypeEnum.TASK,
        task._id.toString(),
        {
          bodyJson: tiptapDoc("Hello ", outsider.userId),
          plainText: "Hello Outsider",
        }
      )
    ).rejects.toThrow(/must belong to the comment workspace/i);
  });

  it("supports project comments without creating task references", async () => {
    const owner = await registerUser("project-comment-owner@example.com", "Owner");
    const { project } = await createTaskTarget(owner);

    const { comment } = await createCommentService(
      makeContext(owner.userId, owner.workspaceId),
      CommentTargetTypeEnum.PROJECT,
      project._id.toString(),
      {
        bodyJson: tiptapDoc("Project note"),
        plainText: "Project note",
      }
    );

    const taskReferenceCount = await TaskModel.countDocuments({
      _id: comment.targetId,
      workspace: owner.workspaceId,
    });
    const workspace = await WorkspaceModel.findById(owner.workspaceId);

    expect(comment.targetType).toBe(CommentTargetTypeEnum.PROJECT);
    expect(taskReferenceCount).toBe(0);
    expect(workspace).toBeTruthy();
  });
});
