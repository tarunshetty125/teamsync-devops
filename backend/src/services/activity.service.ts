import mongoose, { ClientSession } from "mongoose";
import {
  ActivityType,
  DomainEntityType,
} from "../enums/domain.enum";
import ActivityModel from "../models/activity.model";
import { RequestContext } from "../types/request-context";

type RecordActivityInput = {
  type: ActivityType;
  entityType: DomainEntityType;
  entityId: string;
  projectId?: string | null;
  taskId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

export const recordActivity = async (
  context: RequestContext,
  input: RecordActivityInput,
  session?: ClientSession
) => {
  const activityInput = {
    workspace: new mongoose.Types.ObjectId(context.workspaceId),
    actor: new mongoose.Types.ObjectId(context.userId),
    type: input.type,
    entityType: input.entityType,
    entityId: new mongoose.Types.ObjectId(input.entityId),
    project: input.projectId
      ? new mongoose.Types.ObjectId(input.projectId)
      : null,
    task: input.taskId ? new mongoose.Types.ObjectId(input.taskId) : null,
    summary: input.summary,
    metadata: input.metadata,
    requestId: context.requestId,
  };

  const activity = session
    ? (await ActivityModel.create([activityInput], { session }))[0]
    : await ActivityModel.create(activityInput);

  return { activity };
};
