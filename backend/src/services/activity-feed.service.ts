import mongoose from "mongoose";
import { CommentTargetType, DomainEntityTypeEnum } from "../enums/domain.enum";
import ActivityModel from "../models/activity.model";

type ActivityFeedFilters = {
  targetType?: CommentTargetType;
  targetId?: string;
};

type PaginationInput = {
  pageSize: number;
  pageNumber: number;
};

export const getActivityFeedService = async (
  workspaceId: string,
  filters: ActivityFeedFilters,
  pagination: PaginationInput
) => {
  const { pageSize, pageNumber } = pagination;
  const skip = (pageNumber - 1) * pageSize;
  const query: Record<string, unknown> = {
    workspace: new mongoose.Types.ObjectId(workspaceId),
  };

  if (filters.targetType && filters.targetId) {
    query["metadata.targetType"] = filters.targetType;
    query["metadata.targetId"] = filters.targetId;
  }

  if (filters.targetType === DomainEntityTypeEnum.TASK && filters.targetId) {
    query.task = new mongoose.Types.ObjectId(filters.targetId);
  }

  if (filters.targetType === DomainEntityTypeEnum.PROJECT && filters.targetId) {
    query.project = new mongoose.Types.ObjectId(filters.targetId);
  }

  const [activities, totalCount] = await Promise.all([
    ActivityModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate("actor", "_id name email profilePicture")
      .lean(),
    ActivityModel.countDocuments(query),
  ]);

  return {
    activities,
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
