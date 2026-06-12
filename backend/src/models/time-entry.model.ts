import mongoose, { Document, Schema } from "mongoose";
import {
  TimeEntrySourceEnum,
  TimeEntrySourceType,
} from "../enums/domain.enum";

export interface TimeEntryDocument extends Document {
  workspace: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  task?: mongoose.Types.ObjectId | null;
  project?: mongoose.Types.ObjectId | null;
  taskTitle?: string | null;
  taskCode?: string | null;
  projectName?: string | null;
  startedAt: Date;
  endedAt?: Date | null;
  durationSeconds: number;
  note?: string | null;
  source: TimeEntrySourceType;
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const timeEntrySchema = new Schema<TimeEntryDocument>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    taskTitle: {
      type: String,
      trim: true,
      default: null,
    },
    taskCode: {
      type: String,
      trim: true,
      default: null,
    },
    projectName: {
      type: String,
      trim: true,
      default: null,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    note: {
      type: String,
      trim: true,
      default: null,
    },
    source: {
      type: String,
      enum: Object.values(TimeEntrySourceEnum),
      required: true,
      default: TimeEntrySourceEnum.MANUAL,
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

timeEntrySchema.index({ workspace: 1, user: 1, startedAt: -1 });
timeEntrySchema.index({ workspace: 1, user: 1, deletedAt: 1, startedAt: -1 });
timeEntrySchema.index({ workspace: 1, project: 1, deletedAt: 1, startedAt: -1 });
timeEntrySchema.index({ workspace: 1, task: 1, deletedAt: 1, startedAt: -1 });
timeEntrySchema.index({ workspace: 1, source: 1, endedAt: 1, deletedAt: 1 });
timeEntrySchema.index({ task: 1, startedAt: -1 });
timeEntrySchema.index({ workspace: 1, deletedAt: 1, startedAt: -1 });
timeEntrySchema.index(
  { workspace: 1, user: 1, source: 1, endedAt: 1, deletedAt: 1 },
  {
    unique: true,
    partialFilterExpression: {
      source: TimeEntrySourceEnum.TIMER,
      endedAt: null,
      deletedAt: null,
    },
  }
);

const TimeEntryModel = mongoose.model<TimeEntryDocument>(
  "TimeEntry",
  timeEntrySchema
);

export default TimeEntryModel;
