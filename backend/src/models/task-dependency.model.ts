import mongoose, { Document, Schema } from "mongoose";
import {
  TaskDependencyTypeEnum,
  TaskDependencyTypeEnumType,
} from "../enums/task.enum";

export interface TaskDependencyDocument extends Document {
  workspace: mongoose.Types.ObjectId;
  predecessorTask: mongoose.Types.ObjectId;
  successorTask: mongoose.Types.ObjectId;
  type: TaskDependencyTypeEnumType;
  createdBy: mongoose.Types.ObjectId;
  deletedAt: Date | null;
  deletedBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const taskDependencySchema = new Schema<TaskDependencyDocument>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    predecessorTask: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    successorTask: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(TaskDependencyTypeEnum),
      default: TaskDependencyTypeEnum.FINISH_TO_START,
      required: true,
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

taskDependencySchema.index(
  { workspace: 1, predecessorTask: 1, successorTask: 1, deletedAt: 1 },
  { unique: true }
);
taskDependencySchema.index({ workspace: 1, successorTask: 1, deletedAt: 1 });
taskDependencySchema.index({ workspace: 1, predecessorTask: 1, deletedAt: 1 });

const TaskDependencyModel = mongoose.model<TaskDependencyDocument>(
  "TaskDependency",
  taskDependencySchema
);

export default TaskDependencyModel;
