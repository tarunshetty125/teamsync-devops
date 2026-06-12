import { describe, expect, it } from "vitest";
import CommentModel from "../src/models/comment.model";
import MemberModel from "../src/models/member.model";
import ProjectModel from "../src/models/project.model";
import RoleModel from "../src/models/roles-permission.model";
import TaskModel from "../src/models/task.model";
import UserModel from "../src/models/user.model";
import WorkspaceModel from "../src/models/workspace.model";
import { CommentTargetTypeEnum } from "../src/enums/domain.enum";
import { Roles } from "../src/enums/role.enum";
import { TaskPriorityEnum, TaskStatusEnum } from "../src/enums/task.enum";
import { registerUserService } from "../src/services/auth.service";
import { createCommentService } from "../src/services/comment.service";
import { createProjectService } from "../src/services/project.service";
import {
  searchWorkspacePreviewService,
  searchWorkspaceTypeService,
} from "../src/services/search.service";
import { createTaskService } from "../src/services/task.service";
import { RequestContext } from "../src/types/request-context";

const password = "Str0ng!Pass";

const contextFor = (userId: string, workspaceId: string): RequestContext => ({
  requestId: `${userId}-${workspaceId}`,
  userId,
  workspaceId,
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
});

const commentPayload = (plainText: string) => ({
  plainText,
  bodyJson: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: plainText }],
      },
    ],
  },
});

const registerUser = async (email: string, name = "Search User") => {
  const result = await registerUserService({
    email,
    name,
    password,
  });
  const user = await UserModel.findById(result.userId);
  const workspace = await WorkspaceModel.findById(result.workspaceId);

  if (!user || !workspace) {
    throw new Error("Expected user and workspace");
  }

  return { user, workspace };
};

const createSearchFixture = async () => {
  const { user, workspace } = await registerUser(
    "search-owner@example.com",
    "Search Owner"
  );
  const context = contextFor(user._id.toString(), workspace._id.toString());
  const { project } = await createProjectService(
    user._id.toString(),
    workspace._id.toString(),
    {
      name: "Project Alpha",
      description: "Important product planning workspace",
    },
    context
  );
  const { task } = await createTaskService(
    workspace._id.toString(),
    project._id.toString(),
    user._id.toString(),
    {
      title: "API Validation Task",
      description: "Backend validation should happen before persistence",
      priority: TaskPriorityEnum.HIGH,
      status: TaskStatusEnum.TODO,
    },
    context
  );

  await createCommentService(
    context,
    CommentTargetTypeEnum.TASK,
    task._id.toString(),
    commentPayload(
      "API validation should happen before controllers call services because malformed input can create confusing audit records and noisy activity trails for teams."
    )
  );

  return { user, workspace, project, task, context };
};

describe("global workspace search", () => {
  it("defines source collection indexes without adding a user text index", async () => {
    const [projectIndexes, taskIndexes, commentIndexes, memberIndexes, userIndexes] =
      await Promise.all([
        ProjectModel.collection.indexes(),
        TaskModel.collection.indexes(),
        CommentModel.collection.indexes(),
        MemberModel.collection.indexes(),
        UserModel.collection.indexes(),
      ]);

    expect(projectIndexes.some((index) => index.name === "project_workspace_text"))
      .toBe(true);
    expect(taskIndexes.some((index) => index.name === "task_workspace_text")).toBe(
      true
    );
    expect(
      commentIndexes.some((index) => index.name === "comment_workspace_text")
    ).toBe(true);
    expect(
      memberIndexes.some(
        (index) =>
          index.key.workspaceId === 1 &&
          index.key.userId === 1 &&
          index.unique === true
      )
    ).toBe(true);
    expect(
      userIndexes.some((index) =>
        Object.values(index.key).some((value) => value === "text")
      )
    ).toBe(false);
  });

  it("searches projects, tasks, comments, and members from source collections", async () => {
    const { user, workspace } = await createSearchFixture();

    const preview = await searchWorkspacePreviewService(
      workspace._id.toString(),
      "api",
      undefined,
      5
    );

    const taskGroup = preview.groups.find((group) => group.type === "TASK");
    const commentGroup = preview.groups.find((group) => group.type === "COMMENT");
    const memberGroup = preview.groups.find((group) => group.type === "MEMBER");

    expect(taskGroup?.results[0]).toMatchObject({
      type: "TASK",
      title: "API Validation Task",
      canView: true,
    });
    expect(commentGroup?.results[0]?.snippet.length).toBeLessThanOrEqual(150);
    expect(commentGroup?.results[0]).toMatchObject({
      type: "COMMENT",
      canView: true,
    });
    expect(memberGroup?.results.some((result) => result.entityId)).toBe(false);

    const memberPreview = await searchWorkspacePreviewService(
      workspace._id.toString(),
      user.name.slice(0, 3),
      ["MEMBER"],
      5
    );
    expect(memberPreview.groups[0].results[0]).toMatchObject({
      type: "MEMBER",
      title: user.name,
      canView: true,
    });
  });

  it("uses prefix fallback and paginates type-specific results", async () => {
    const { user, workspace } = await createSearchFixture();
    const context = contextFor(user._id.toString(), workspace._id.toString());

    await createProjectService(
      user._id.toString(),
      workspace._id.toString(),
      { name: "Project Beta", description: "Second project" },
      context
    );

    const prefixPreview = await searchWorkspacePreviewService(
      workspace._id.toString(),
      "proj",
      ["PROJECT"],
      5
    );
    expect(prefixPreview.groups[0].results.map((result) => result.title)).toEqual(
      expect.arrayContaining(["Project Alpha", "Project Beta"])
    );

    const page = await searchWorkspaceTypeService(
      workspace._id.toString(),
      "PROJECT",
      "proj",
      1,
      2
    );

    expect(page.results).toHaveLength(1);
    expect(page.pagination.totalCount).toBe(2);
    expect(page.pagination.totalPages).toBe(2);
  });

  it("does not expose users who are not members of the searched workspace", async () => {
    const { workspace } = await createSearchFixture();
    const outside = await registerUser("outside@example.com", "Outside User");
    const memberRole = await RoleModel.findOne({ name: Roles.MEMBER });

    if (!memberRole) {
      throw new Error("Expected member role");
    }

    await MemberModel.create({
      userId: outside.user._id,
      workspaceId: outside.workspace._id,
      role: memberRole._id,
    }).catch(() => undefined);

    const result = await searchWorkspacePreviewService(
      workspace._id.toString(),
      "out",
      ["MEMBER"],
      5
    );

    expect(result.groups[0].results).toHaveLength(0);
  });

  it("hides soft-deleted comments and comments with invalid workspace targets", async () => {
    const { workspace, task, context } = await createSearchFixture();
    const deleted = await createCommentService(
      context,
      CommentTargetTypeEnum.TASK,
      task._id.toString(),
      commentPayload("deleted searchable phrase")
    );
    await CommentModel.updateOne(
      { _id: deleted.comment._id },
      { $set: { deletedAt: new Date(), deletedBy: context.userId } }
    );
    await CommentModel.create({
      workspace: workspace._id,
      author: context.userId,
      targetType: CommentTargetTypeEnum.TASK,
      targetId: task._id,
      plainText: "orphan searchable phrase",
      bodyJson: commentPayload("orphan searchable phrase").bodyJson,
      mentions: [],
    });
    await TaskModel.deleteOne({ _id: task._id });

    const result = await searchWorkspacePreviewService(
      workspace._id.toString(),
      "searchable",
      ["COMMENT"],
      5
    );

    expect(result.groups[0].results).toHaveLength(0);
  });
});
