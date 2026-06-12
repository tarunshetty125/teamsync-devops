import mongoose, { Document, Schema } from "mongoose";
import {
  TaskPriorityEnum,
  TaskPriorityEnumType,
  TaskRecurrenceFrequencyEnum,
  TaskRecurrenceFrequencyEnumType,
  TaskStatusEnum,
  TaskStatusEnumType,
} from "../enums/task.enum";
import { generateTaskCode } from "../utils/uuid";

export interface TaskChecklistItem {
  _id: mongoose.Types.ObjectId;
  text: string;
  order: number;
  completed: boolean;
  completedAt: Date | null;
  completedBy: mongoose.Types.ObjectId | null;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskRecurrence {
  enabled: boolean;
  frequency: TaskRecurrenceFrequencyEnumType | null;
  interval: number;
  endsAt: Date | null;
  maxOccurrences: number | null;
  occurrenceIndex: number;
  seriesRoot: mongoose.Types.ObjectId | null;
  previousOccurrence: mongoose.Types.ObjectId | null;
}

export interface TaskDocument extends Document {
  taskCode: string;
  title: string;
  description: string | null;
  project: mongoose.Types.ObjectId;
  workspace: mongoose.Types.ObjectId;
  status: TaskStatusEnumType;
  priority: TaskPriorityEnumType;
  assignedTo: mongoose.Types.ObjectId | null;
  createdBy: mongoose.Types.ObjectId;
  startDate: Date | null;
  endDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  parentTask: mongoose.Types.ObjectId | null;
  rootTask: mongoose.Types.ObjectId | null;
  subtaskDepth: number;
  subtaskOrder: number;
  labels: mongoose.Types.ObjectId[];
  checklist: TaskChecklistItem[];
  recurrence: TaskRecurrence;
  generatedFromTaskId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const checklistItemSchema = new Schema<TaskChecklistItem>(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    order: {
      type: Number,
      required: true,
      min: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

const recurrenceSchema = new Schema<TaskRecurrence>(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    frequency: {
      type: String,
      enum: Object.values(TaskRecurrenceFrequencyEnum),
      default: null,
    },
    interval: {
      type: Number,
      min: 1,
      default: 1,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    maxOccurrences: {
      type: Number,
      min: 1,
      default: null,
    },
    occurrenceIndex: {
      type: Number,
      min: 1,
      default: 1,
    },
    seriesRoot: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    previousOccurrence: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
  },
  {
    _id: false,
  }
);

const taskSchema = new Schema<TaskDocument>(
  {
    taskCode: {
      type: String,
      unique: true,
      default: generateTaskCode,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TaskStatusEnum),
      default: TaskStatusEnum.TODO,
    },
    priority: {
      type: String,
      enum: Object.values(TaskPriorityEnum),
      default: TaskPriorityEnum.MEDIUM,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
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
    parentTask: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    rootTask: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    subtaskDepth: {
      type: Number,
      min: 0,
      max: 3,
      default: 0,
    },
    subtaskOrder: {
      type: Number,
      min: 0,
      default: 0,
    },
    labels: [
      {
        type: Schema.Types.ObjectId,
        ref: "Label",
      },
    ],
    checklist: {
      type: [checklistItemSchema],
      default: [],
    },
    recurrence: {
      type: recurrenceSchema,
      default: () => ({
        enabled: false,
        frequency: null,
        interval: 1,
        endsAt: null,
        maxOccurrences: null,
        occurrenceIndex: 1,
        seriesRoot: null,
        previousOccurrence: null,
      }),
    },
    generatedFromTaskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ workspace: 1, project: 1, createdAt: -1 });
taskSchema.index({ workspace: 1, project: 1, status: 1, createdAt: -1 });
taskSchema.index({ workspace: 1, status: 1, createdAt: -1 });
taskSchema.index({ workspace: 1, priority: 1, createdAt: -1 });
taskSchema.index({ workspace: 1, assignedTo: 1, createdAt: -1 });
taskSchema.index({ workspace: 1, dueDate: 1 });
taskSchema.index({ workspace: 1, project: 1, startDate: 1, endDate: 1 });
taskSchema.index({ workspace: 1, startDate: 1, endDate: 1 });
taskSchema.index({ workspace: 1, completedAt: -1 });
taskSchema.index({ workspace: 1, project: 1, completedAt: -1 });
taskSchema.index({ workspace: 1, parentTask: 1, subtaskOrder: 1, createdAt: 1 });
taskSchema.index({ workspace: 1, rootTask: 1, subtaskDepth: 1 });
taskSchema.index({ workspace: 1, labels: 1, createdAt: -1 });
taskSchema.index({ workspace: 1, "recurrence.enabled": 1, createdAt: -1 });
taskSchema.index({ workspace: 1, generatedFromTaskId: 1 });
taskSchema.index(
  { workspace: 1, title: "text", description: "text", taskCode: "text" },
  {
    name: "task_workspace_text",
    weights: {
      title: 10,
      taskCode: 8,
      description: 3,
    },
  }
);

const TaskModel = mongoose.model<TaskDocument>("Task", taskSchema);

export default TaskModel;
