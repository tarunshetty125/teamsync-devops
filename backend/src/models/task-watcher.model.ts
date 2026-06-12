import mongoose, { Document, Schema } from "mongoose";
import {
  TaskWatcherSourceEnum,
  TaskWatcherSourceEnumType,
} from "../enums/task.enum";

export interface TaskWatcherDocument extends Document {
  workspace: mongoose.Types.ObjectId;
  task: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  source: TaskWatcherSourceEnumType;
  addedBy: mongoose.Types.ObjectId;
  deletedAt: Date | null;
  deletedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const taskWatcherSchema = new Schema<TaskWatcherDocument>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    source: {
      type: String,
      enum: Object.values(TaskWatcherSourceEnum),
      required: true,
    },
    addedBy: {
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

taskWatcherSchema.index(
  { workspace: 1, task: 1, user: 1, deletedAt: 1 },
  { unique: true }
);
taskWatcherSchema.index({ workspace: 1, task: 1, deletedAt: 1 });
taskWatcherSchema.index({ workspace: 1, user: 1, deletedAt: 1 });

const TaskWatcherModel = mongoose.model<TaskWatcherDocument>(
  "TaskWatcher",
  taskWatcherSchema
);

export default TaskWatcherModel;
