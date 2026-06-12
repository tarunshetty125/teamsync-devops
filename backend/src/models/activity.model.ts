import mongoose, { Document, Schema } from "mongoose";
import {
  ActivityType,
  ActivityTypeEnum,
  DomainEntityType,
  DomainEntityTypeEnum,
} from "../enums/domain.enum";

export interface ActivityDocument extends Document {
  workspace: mongoose.Types.ObjectId;
  actor: mongoose.Types.ObjectId;
  type: ActivityType;
  entityType: DomainEntityType;
  entityId: mongoose.Types.ObjectId;
  project?: mongoose.Types.ObjectId | null;
  task?: mongoose.Types.ObjectId | null;
  summary: string;
  metadata?: Record<string, unknown>;
  requestId: string;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<ActivityDocument>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(ActivityTypeEnum),
      required: true,
    },
    entityType: {
      type: String,
      enum: Object.values(DomainEntityTypeEnum),
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    requestId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

activitySchema.index({ workspace: 1, createdAt: -1 });
activitySchema.index({ workspace: 1, type: 1, createdAt: -1 });
activitySchema.index({ workspace: 1, entityType: 1, createdAt: -1 });
activitySchema.index({ project: 1, createdAt: -1 });
activitySchema.index({ task: 1, createdAt: -1 });
activitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

const ActivityModel = mongoose.model<ActivityDocument>(
  "Activity",
  activitySchema
);

export default ActivityModel;
