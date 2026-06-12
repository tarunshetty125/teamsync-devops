import mongoose from "mongoose";
import {
  AuditActionEnum,
  DomainEntityTypeEnum,
} from "../enums/domain.enum";
import LabelModel from "../models/label.model";
import { RequestContext } from "../types/request-context";
import { BadRequestException, NotFoundException } from "../utils/appError";
import { recordAuditLog } from "./audit-log.service";

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

export const listLabelsService = async (
  workspaceId: string,
  {
    pageSize,
    pageNumber,
    includeDeleted = false,
  }: { pageSize: number; pageNumber: number; includeDeleted?: boolean }
) => {
  const skip = (pageNumber - 1) * pageSize;
  const query: Record<string, unknown> = { workspace: workspaceId };

  if (!includeDeleted) {
    query.deletedAt = null;
  }

  const [labels, totalCount] = await Promise.all([
    LabelModel.find(query).sort({ name: 1 }).skip(skip).limit(pageSize).lean(),
    LabelModel.countDocuments(query),
  ]);

  return {
    labels,
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

export const createLabelService = async (
  context: RequestContext,
  body: { name: string; color: string; description?: string | null }
) => {
  try {
    const label = await LabelModel.create({
      workspace: new mongoose.Types.ObjectId(context.workspaceId),
      name: body.name,
      color: body.color,
      description: body.description || null,
      createdBy: new mongoose.Types.ObjectId(context.userId),
    });

    await recordAuditLog(context, {
      action: AuditActionEnum.CREATED,
      entityType: DomainEntityTypeEnum.LABEL,
      entityId: label._id.toString(),
      after: {
        name: label.name,
        color: label.color,
      },
    });

    return { label };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new BadRequestException("Label already exists in this workspace");
    }

    throw error;
  }
};

export const updateLabelService = async (
  context: RequestContext,
  labelId: string,
  body: { name?: string; color?: string; description?: string | null }
) => {
  try {
    const label = await LabelModel.findOneAndUpdate(
      {
        _id: labelId,
        workspace: context.workspaceId,
        deletedAt: null,
      },
      {
        $set: body,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!label) {
      throw new NotFoundException("Label not found");
    }

    await recordAuditLog(context, {
      action: AuditActionEnum.UPDATED,
      entityType: DomainEntityTypeEnum.LABEL,
      entityId: label._id.toString(),
      after: body,
    });

    return { label };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new BadRequestException("Label already exists in this workspace");
    }

    throw error;
  }
};

export const softDeleteLabelService = async (
  context: RequestContext,
  labelId: string
) => {
  const label = await LabelModel.findOneAndUpdate(
    {
      _id: labelId,
      workspace: context.workspaceId,
      deletedAt: null,
    },
    {
      $set: {
        deletedAt: new Date(),
        deletedBy: new mongoose.Types.ObjectId(context.userId),
      },
    },
    {
      new: true,
    }
  );

  if (!label) {
    throw new NotFoundException("Label not found");
  }

  await recordAuditLog(context, {
    action: AuditActionEnum.DELETED,
    entityType: DomainEntityTypeEnum.LABEL,
    entityId: label._id.toString(),
  });

  return { label };
};
