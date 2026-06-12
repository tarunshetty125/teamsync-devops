import mongoose, { Document, Schema } from "mongoose";
import {
  MilestoneStatusEnum,
  MilestoneStatusType,
} from "../enums/domain.enum";

export interface MilestoneDocument extends Document {
  workspace: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  name: string;
  description?: string | null;
  status: MilestoneStatusType;
  startDate?: Date | null;
  dueDate?: Date | null;
  completedAt?: Date | null;
  createdBy: mongoose.Types.ObjectId;
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const milestoneSchema = new Schema<MilestoneDocument>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(MilestoneStatusEnum),
      required: true,
      default: MilestoneStatusEnum.PLANNED,
    },
    startDate: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

milestoneSchema.index({ workspace: 1, dueDate: 1 });
milestoneSchema.index({ project: 1, dueDate: 1 });
milestoneSchema.index({ workspace: 1, deletedAt: 1, createdAt: -1 });
milestoneSchema.index({ workspace: 1, project: 1, deletedAt: 1, dueDate: 1 });
milestoneSchema.index({ workspace: 1, deletedAt: 1, startDate: 1 });

const MilestoneModel = mongoose.model<MilestoneDocument>(
  "Milestone",
  milestoneSchema
);

export default MilestoneModel;
