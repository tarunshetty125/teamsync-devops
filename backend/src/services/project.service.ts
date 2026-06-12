import mongoose from "mongoose";
import ProjectModel from "../models/project.model";
import TaskModel from "../models/task.model";
import { NotFoundException } from "../utils/appError";
import { TaskStatusEnum } from "../enums/task.enum";
import { DomainEntityTypeEnum, DomainEventTypeEnum } from "../enums/domain.enum";
import { RequestContext } from "../types/request-context";
import { emitDomainEvent } from "./domain-event.service";
import { deleteStoredFiles, softDeleteFilesForTarget } from "./file-cleanup.service";
import { cleanupAdvancedTaskRecordsForProject } from "./task.service";
import { detachTimeEntriesForProject } from "./time.service";

export const createProjectService = async (
  userId: string,
  workspaceId: string,
  body: {
    emoji?: string;
    name: string;
    description?: string;
  },
  context?: RequestContext
) => {
  const project = new ProjectModel({
    ...(body.emoji && { emoji: body.emoji }),
    name: body.name,
    description: body.description,
    workspace: workspaceId,
    createdBy: userId,
  });

  await project.save();

  if (context) {
    await emitDomainEvent({
      type: DomainEventTypeEnum.PROJECT_CREATED,
      context,
      entityType: DomainEntityTypeEnum.PROJECT,
      entityId: project._id.toString(),
      target: {
        type: DomainEntityTypeEnum.PROJECT,
        id: project._id.toString(),
      },
      metadata: {
        name: project.name,
      },
      occurredAt: new Date(),
    });
  }

  return { project };
};

export const getProjectsInWorkspaceService = async (
  workspaceId: string,
  pageSize: number,
  pageNumber: number
) => {
  // Step 1: Find all projects in the workspace

  const totalCount = await ProjectModel.countDocuments({
    workspace: workspaceId,
  });

  const skip = (pageNumber - 1) * pageSize;

  const projects = await ProjectModel.find({
    workspace: workspaceId,
  })
    .skip(skip)
    .limit(pageSize)
    .populate("createdBy", "_id name profilePicture")
    .sort({ createdAt: -1 });

  const totalPages = Math.ceil(totalCount / pageSize);

  return { projects, totalCount, totalPages, skip };
};

export const getProjectByIdAndWorkspaceIdService = async (
  workspaceId: string,
  projectId: string
) => {
  const project = await ProjectModel.findOne({
    _id: projectId,
    workspace: workspaceId,
  }).select("_id emoji name description");

  if (!project) {
    throw new NotFoundException(
      "Project not found or does not belong to the specified workspace"
    );
  }

  return { project };
};

export const getProjectAnalyticsService = async (
  workspaceId: string,
  projectId: string
) => {
  const project = await ProjectModel.findById(projectId);

  if (!project || project.workspace.toString() !== workspaceId.toString()) {
    throw new NotFoundException(
      "Project not found or does not belong to this workspace"
    );
  }

  const currentDate = new Date();

  //USING Mongoose aggregate
  const taskAnalytics = await TaskModel.aggregate([
    {
      $match: {
        project: new mongoose.Types.ObjectId(projectId),
      },
    },
    {
      $facet: {
        totalTasks: [{ $count: "count" }],
        overdueTasks: [
          {
            $match: {
              dueDate: { $lt: currentDate },
              status: {
                $ne: TaskStatusEnum.DONE,
              },
            },
          },
          {
            $count: "count",
          },
        ],
        completedTasks: [
          {
            $match: {
              status: TaskStatusEnum.DONE,
            },
          },
          { $count: "count" },
        ],
      },
    },
  ]);

  const _analytics = taskAnalytics[0];

  const analytics = {
    totalTasks: _analytics.totalTasks[0]?.count || 0,
    overdueTasks: _analytics.overdueTasks[0]?.count || 0,
    completedTasks: _analytics.completedTasks[0]?.count || 0,
  };

  return {
    analytics,
  };
};

export const updateProjectService = async (
  workspaceId: string,
  projectId: string,
  body: {
    emoji?: string;
    name: string;
    description?: string;
  }
) => {
  const { name, emoji, description } = body;

  const project = await ProjectModel.findOne({
    _id: projectId,
    workspace: workspaceId,
  });

  if (!project) {
    throw new NotFoundException(
      "Project not found or does not belong to the specified workspace"
    );
  }

  if (emoji !== undefined) project.emoji = emoji;
  if (name !== undefined) project.name = name;
  if (description !== undefined) project.description = description;

  await project.save();

  return { project };
};

export const deleteProjectService = async (
  workspaceId: string,
  projectId: string,
  userId?: string
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const storageKeys: string[] = [];

  try {
    const project = await ProjectModel.findOne({
      _id: projectId,
      workspace: workspaceId,
    }).session(session);

    if (!project) {
      throw new NotFoundException(
        "Project not found or does not belong to the specified workspace"
      );
    }

    const tasks = await TaskModel.find({
      project: project._id,
      workspace: workspaceId,
    })
      .select("_id")
      .session(session);

    storageKeys.push(
      ...(await softDeleteFilesForTarget({
        workspaceId,
        targetType: DomainEntityTypeEnum.PROJECT,
        targetId: projectId,
        deletedBy: userId,
        session,
        deletePhysical: false,
      }))
    );

    await Promise.all(
      tasks.map((task) =>
        softDeleteFilesForTarget({
          workspaceId,
          targetType: DomainEntityTypeEnum.TASK,
          targetId: task._id.toString(),
          deletedBy: userId,
          session,
          deletePhysical: false,
        }).then((keys) => storageKeys.push(...keys))
      )
    );

    await cleanupAdvancedTaskRecordsForProject({
      workspaceId,
      projectId,
      deletedBy: userId,
      session,
    });

    await detachTimeEntriesForProject({
      workspaceId,
      projectId,
      taskIds: tasks.map((task) => task._id),
      deletedBy: userId,
      session,
    });

    await TaskModel.deleteMany({
      project: project._id,
      workspace: workspaceId,
    }).session(session);

    await project.deleteOne({ session });
    await session.commitTransaction();
    await deleteStoredFiles(storageKeys);

    return project;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};
