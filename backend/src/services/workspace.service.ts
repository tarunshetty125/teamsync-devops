import mongoose from "mongoose";
import { Roles } from "../enums/role.enum";
import MemberModel from "../models/member.model";
import RoleModel from "../models/roles-permission.model";
import UserModel from "../models/user.model";
import WorkspaceModel from "../models/workspace.model";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "../utils/appError";
import TaskModel from "../models/task.model";
import { TaskStatusEnum } from "../enums/task.enum";
import ProjectModel from "../models/project.model";
import NotificationModel from "../models/notification.model";
import NotificationPreferenceModel from "../models/notification-preference.model";
import { getAssignableRoleOrThrow } from "./governance-access.service";
import WorkspacePolicyModel from "../models/workspace-policy.model";
import ExportJobModel from "../models/export-job.model";
import AuditLogModel from "../models/audit-log.model";
import ActivityModel from "../models/activity.model";
import CommentModel from "../models/comment.model";
import FileAssetModel from "../models/file-asset.model";
import LabelModel from "../models/label.model";
import MentionModel from "../models/mention.model";
import MilestoneModel from "../models/milestone.model";
import TaskDependencyModel from "../models/task-dependency.model";
import TaskWatcherModel from "../models/task-watcher.model";
import TimeEntryModel from "../models/time-entry.model";

//********************************
// CREATE NEW WORKSPACE
//**************** **************/
export const createWorkspaceService = async (
  userId: string,
  body: {
    name: string;
    description?: string | undefined;
  }
) => {
  const { name, description } = body;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const user = await UserModel.findById(userId).session(session);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const ownerRole = await RoleModel.findOne({
      name: Roles.OWNER,
      isSystem: true,
    }).session(session);

    if (!ownerRole) {
      throw new NotFoundException("Owner role not found");
    }

    const workspace = new WorkspaceModel({
      name,
      description,
      owner: user._id,
    });

    await workspace.save({ session });

    const member = new MemberModel({
      userId: user._id,
      workspaceId: workspace._id,
      role: ownerRole._id,
      joinedAt: new Date(),
    });

    await member.save({ session });

    user.currentWorkspace = workspace._id as mongoose.Types.ObjectId;
    await user.save({ session });

    await session.commitTransaction();

    return {
      workspace,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

//********************************
// GET WORKSPACES USER IS A MEMBER
//**************** **************/
export const getAllWorkspacesUserIsMemberService = async (userId: string) => {
  const memberships = await MemberModel.find({
    userId,
    status: { $ne: "DEACTIVATED" },
  })
    .populate("workspaceId")
    .exec();

  // Extract workspace details from memberships
  const workspaces = memberships.map((membership) => membership.workspaceId);

  return { workspaces };
};

export const getWorkspaceByIdService = async (workspaceId: string) => {
  const workspace = await WorkspaceModel.findById(workspaceId);

  if (!workspace) {
    throw new NotFoundException("Workspace not found");
  }

  const members = await MemberModel.find({
    workspaceId,
  }).populate("role", "name permissions isSystem");

  const workspaceWithMembers = {
    ...workspace.toObject(),
    members,
  };

  return {
    workspace: workspaceWithMembers,
  };
};

//********************************
// GET ALL MEMEBERS IN WORKSPACE
//**************** **************/

export const getWorkspaceMembersService = async (workspaceId: string) => {
  // Fetch all members of the workspace

  const members = await MemberModel.find({
    workspaceId,
  })
    .populate("userId", "name email profilePicture")
    .populate("role", "name permissions isSystem");

  const roles = await RoleModel.find({
    deletedAt: null,
    $or: [{ isSystem: true, workspace: null }, { workspace: workspaceId }],
  })
    .select("_id name permissions isSystem description")
    .sort({ isSystem: -1, name: 1 })
    .lean();

  return { members, roles };
};

export const getWorkspaceAnalyticsService = async (workspaceId: string) => {
  const currentDate = new Date();

  const totalTasks = await TaskModel.countDocuments({
    workspace: workspaceId,
  });

  const overdueTasks = await TaskModel.countDocuments({
    workspace: workspaceId,
    dueDate: { $lt: currentDate },
    status: { $ne: TaskStatusEnum.DONE },
  });

  const completedTasks = await TaskModel.countDocuments({
    workspace: workspaceId,
    status: TaskStatusEnum.DONE,
  });

  const analytics = {
    totalTasks,
    overdueTasks,
    completedTasks,
  };

  return { analytics };
};

export const changeMemberRoleService = async (
  workspaceId: string,
  memberId: string,
  roleId: string
) => {
  const workspace = await WorkspaceModel.findById(workspaceId);
  if (!workspace) {
    throw new NotFoundException("Workspace not found");
  }

  const role = await getAssignableRoleOrThrow(workspaceId, roleId);

  if (role.isSystem && role.name === Roles.OWNER) {
    throw new BadRequestException("Workspace ownership cannot be assigned here");
  }

  const member = await MemberModel.findOne({
    userId: memberId,
    workspaceId: workspaceId,
    status: { $ne: "DEACTIVATED" },
  });

  if (!member) {
    throw new NotFoundException("Member not found in the workspace");
  }

  if (workspace.owner.equals(member.userId)) {
    throw new BadRequestException("Workspace owner role cannot be changed");
  }

  member.role = role;
  await member.save();

  return {
    member,
  };
};

//********************************
// UPDATE WORKSPACE
//**************** **************/
export const updateWorkspaceByIdService = async (
  workspaceId: string,
  name: string,
  description?: string
) => {
  const workspace = await WorkspaceModel.findById(workspaceId);
  if (!workspace) {
    throw new NotFoundException("Workspace not found");
  }

  // Update the workspace details
  workspace.name = name || workspace.name;
  workspace.description = description || workspace.description;
  await workspace.save();

  return {
    workspace,
  };
};

export const deleteWorkspaceService = async (
  workspaceId: string,
  userId: string
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const workspace = await WorkspaceModel.findById(workspaceId).session(
      session
    );
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    // Check if the user owns the workspace
    if (!workspace.owner.equals(new mongoose.Types.ObjectId(userId))) { 
      throw new ForbiddenException(
        "You are not authorized to delete this workspace"
      );
    }

    const owner = await UserModel.findById(userId).session(session);
    if (!owner) {
      throw new NotFoundException("User not found");
    }

    const affectedMembers = await MemberModel.find({
      workspaceId: workspace._id,
    })
      .select("userId")
      .session(session);
    const affectedUserIds = affectedMembers.map((member) => member.userId);

    await ProjectModel.deleteMany({ workspace: workspace._id }).session(
      session
    );
    await TaskModel.deleteMany({ workspace: workspace._id }).session(session);
    await NotificationModel.deleteMany({ workspace: workspace._id }).session(
      session
    );
    await NotificationPreferenceModel.deleteMany({
      workspace: workspace._id,
    }).session(session);
    await Promise.all([
      ActivityModel.deleteMany({ workspace: workspace._id }).session(session),
      AuditLogModel.deleteMany({ workspace: workspace._id }).session(session),
      CommentModel.deleteMany({ workspace: workspace._id }).session(session),
      ExportJobModel.deleteMany({ workspace: workspace._id }).session(session),
      FileAssetModel.deleteMany({ workspace: workspace._id }).session(session),
      LabelModel.deleteMany({ workspace: workspace._id }).session(session),
      MentionModel.deleteMany({ workspace: workspace._id }).session(session),
      MilestoneModel.deleteMany({ workspace: workspace._id }).session(session),
      TaskDependencyModel.deleteMany({ workspace: workspace._id }).session(session),
      TaskWatcherModel.deleteMany({ workspace: workspace._id }).session(session),
      TimeEntryModel.deleteMany({ workspace: workspace._id }).session(session),
      WorkspacePolicyModel.deleteMany({ workspace: workspace._id }).session(session),
      RoleModel.deleteMany({
        workspace: workspace._id,
        isSystem: false,
      }).session(session),
    ]);

    await MemberModel.deleteMany({
      workspaceId: workspace._id,
    }).session(session);

    await Promise.all(
      affectedUserIds.map(async (affectedUserId) => {
        const replacementMembership = await MemberModel.findOne({
          userId: affectedUserId,
        }).session(session);

        await UserModel.updateOne(
          {
            _id: affectedUserId,
            currentWorkspace: workspace._id,
          },
          {
            $set: {
              currentWorkspace: replacementMembership
                ? replacementMembership.workspaceId
                : null,
            },
          }
        ).session(session);
      })
    );

    await workspace.deleteOne({ session });

    await session.commitTransaction();

    const updatedOwner = await UserModel.findById(userId).select(
      "currentWorkspace"
    );

    return {
      currentWorkspace: updatedOwner?.currentWorkspace ?? null,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};
