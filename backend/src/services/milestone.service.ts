import mongoose from "mongoose";
import {
  ActivityTypeEnum,
  AuditActionEnum,
  DomainEntityTypeEnum,
  MilestoneStatusEnum,
  MilestoneStatusType,
} from "../enums/domain.enum";
import MilestoneModel, { MilestoneDocument } from "../models/milestone.model";
import ProjectModel from "../models/project.model";
import { RequestContext } from "../types/request-context";
import { BadRequestException, NotFoundException } from "../utils/appError";
import { recordActivity } from "./activity.service";
import { recordAuditLog } from "./audit-log.service";

type MilestoneInput = {
  project: string;
  name: string;
  description?: string | null;
  status?: MilestoneStatusType;
  startDate?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
};

type MilestoneUpdateInput = Partial<MilestoneInput>;

const getObjectId = (id: string) => new mongoose.Types.ObjectId(id);

const toDateOrNull = (value?: string | null) =>
  value ? new Date(value) : null;

const serializeMilestone = (milestone: MilestoneDocument) => ({
  _id: milestone._id.toString(),
  workspace: milestone.workspace.toString(),
  project: milestone.project.toString(),
  name: milestone.name,
  description: milestone.description || null,
  status: milestone.status,
  startDate: milestone.startDate || null,
  dueDate: milestone.dueDate || null,
  completedAt: milestone.completedAt || null,
  createdBy: milestone.createdBy.toString(),
  deletedAt: milestone.deletedAt || null,
  createdAt: milestone.createdAt,
  updatedAt: milestone.updatedAt,
});

const ensureProjectInWorkspace = async (
  workspaceId: string,
  projectId: string
) => {
  const project = await ProjectModel.findOne({
    _id: projectId,
    workspace: workspaceId,
  }).select("_id name emoji");

  if (!project) {
    throw new BadRequestException(
      "Project not found or does not belong to this workspace"
    );
  }

  return project;
};

const completedAtForStatus = (
  status: MilestoneStatusType,
  completedAt?: string | null
) => {
  if (completedAt !== undefined) {
    return toDateOrNull(completedAt);
  }

  return status === MilestoneStatusEnum.COMPLETED ? new Date() : null;
};

export const listMilestonesService = async (workspaceId: string) => {
  const milestones = await MilestoneModel.find({
    workspace: workspaceId,
    deletedAt: null,
  })
    .sort({ dueDate: 1, createdAt: -1 })
    .lean();

  return {
    milestones: milestones.map((milestone) => ({
      ...milestone,
      _id: milestone._id.toString(),
      workspace: milestone.workspace.toString(),
      project: milestone.project.toString(),
      createdBy: milestone.createdBy.toString(),
    })),
  };
};

export const createMilestoneService = async (
  workspaceId: string,
  userId: string,
  body: MilestoneInput,
  context?: RequestContext
) => {
  await ensureProjectInWorkspace(workspaceId, body.project);

  const status = body.status || MilestoneStatusEnum.PLANNED;
  const milestone = await MilestoneModel.create({
    workspace: getObjectId(workspaceId),
    project: getObjectId(body.project),
    name: body.name,
    description: body.description || null,
    status,
    startDate: toDateOrNull(body.startDate),
    dueDate: toDateOrNull(body.dueDate),
    completedAt: completedAtForStatus(status, body.completedAt),
    createdBy: getObjectId(userId),
  });

  if (context) {
    await Promise.all([
      recordAuditLog(context, {
        action: AuditActionEnum.CREATED,
        entityType: DomainEntityTypeEnum.MILESTONE,
        entityId: milestone._id.toString(),
        after: serializeMilestone(milestone),
      }),
      recordActivity(context, {
        type: ActivityTypeEnum.MILESTONE_CREATED,
        entityType: DomainEntityTypeEnum.MILESTONE,
        entityId: milestone._id.toString(),
        projectId: milestone.project.toString(),
        summary: `Created milestone ${milestone.name}`,
      }),
    ]);
  }

  return { milestone: serializeMilestone(milestone) };
};

export const updateMilestoneService = async (
  workspaceId: string,
  milestoneId: string,
  body: MilestoneUpdateInput,
  context?: RequestContext
) => {
  const milestone = await MilestoneModel.findOne({
    _id: milestoneId,
    workspace: workspaceId,
    deletedAt: null,
  });

  if (!milestone) {
    throw new NotFoundException("Milestone not found");
  }

  const before = serializeMilestone(milestone);

  if (body.project !== undefined) {
    await ensureProjectInWorkspace(workspaceId, body.project);
    milestone.project = getObjectId(body.project);
  }
  if (body.name !== undefined) milestone.name = body.name;
  if (body.description !== undefined) {
    milestone.description = body.description || null;
  }
  if (body.startDate !== undefined) {
    milestone.startDate = toDateOrNull(body.startDate);
  }
  if (body.dueDate !== undefined) {
    milestone.dueDate = toDateOrNull(body.dueDate);
  }
  if (
    milestone.startDate &&
    milestone.dueDate &&
    milestone.startDate > milestone.dueDate
  ) {
    throw new BadRequestException("Start date must be before or equal to due date");
  }
  if (body.status !== undefined) {
    milestone.status = body.status;
  }
  if (body.completedAt !== undefined) {
    milestone.completedAt = toDateOrNull(body.completedAt);
  } else if (body.status === MilestoneStatusEnum.COMPLETED && !milestone.completedAt) {
    milestone.completedAt = new Date();
  } else if (
    body.status &&
    body.status !== MilestoneStatusEnum.COMPLETED
  ) {
    milestone.completedAt = null;
  }

  await milestone.save();

  if (context) {
    await Promise.all([
      recordAuditLog(context, {
        action: AuditActionEnum.UPDATED,
        entityType: DomainEntityTypeEnum.MILESTONE,
        entityId: milestone._id.toString(),
        before,
        after: serializeMilestone(milestone),
      }),
      recordActivity(context, {
        type: ActivityTypeEnum.MILESTONE_UPDATED,
        entityType: DomainEntityTypeEnum.MILESTONE,
        entityId: milestone._id.toString(),
        projectId: milestone.project.toString(),
        summary: `Updated milestone ${milestone.name}`,
      }),
    ]);
  }

  return { milestone: serializeMilestone(milestone) };
};

export const deleteMilestoneService = async (
  workspaceId: string,
  milestoneId: string,
  userId: string,
  context?: RequestContext
) => {
  const milestone = await MilestoneModel.findOne({
    _id: milestoneId,
    workspace: workspaceId,
    deletedAt: null,
  });

  if (!milestone) {
    throw new NotFoundException("Milestone not found");
  }

  const before = serializeMilestone(milestone);
  milestone.deletedAt = new Date();
  milestone.deletedBy = getObjectId(userId);
  await milestone.save();

  if (context) {
    await Promise.all([
      recordAuditLog(context, {
        action: AuditActionEnum.DELETED,
        entityType: DomainEntityTypeEnum.MILESTONE,
        entityId: milestone._id.toString(),
        before,
        after: serializeMilestone(milestone),
      }),
      recordActivity(context, {
        type: ActivityTypeEnum.MILESTONE_DELETED,
        entityType: DomainEntityTypeEnum.MILESTONE,
        entityId: milestone._id.toString(),
        projectId: milestone.project.toString(),
        summary: `Deleted milestone ${milestone.name}`,
      }),
    ]);
  }
};
