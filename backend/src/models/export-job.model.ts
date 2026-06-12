import mongoose, { Document, Schema } from "mongoose";

export const ExportDatasetEnum = {
  TASKS: "TASKS",
  PROJECTS: "PROJECTS",
  MEMBERS: "MEMBERS",
  COMMENTS: "COMMENTS",
  FILES: "FILES",
  TIME_ENTRIES: "TIME_ENTRIES",
  AUDIT_LOGS: "AUDIT_LOGS",
} as const;

export const ExportFormatEnum = {
  CSV: "CSV",
  JSON: "JSON",
  XLSX: "XLSX",
} as const;

export const ExportStatusEnum = {
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type ExportDataset =
  (typeof ExportDatasetEnum)[keyof typeof ExportDatasetEnum];
export type ExportFormat = (typeof ExportFormatEnum)[keyof typeof ExportFormatEnum];
export type ExportStatus = (typeof ExportStatusEnum)[keyof typeof ExportStatusEnum];

export interface ExportJobDocument extends Document {
  workspace: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  datasets: ExportDataset[];
  format: ExportFormat;
  status: ExportStatus;
  storageKey?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes: number;
  errorMessage?: string | null;
  expiresAt: Date;
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const exportJobSchema = new Schema<ExportJobDocument>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    datasets: {
      type: [String],
      enum: Object.values(ExportDatasetEnum),
      required: true,
    },
    format: {
      type: String,
      enum: Object.values(ExportFormatEnum),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ExportStatusEnum),
      required: true,
    },
    storageKey: {
      type: String,
      trim: true,
      default: null,
    },
    fileName: {
      type: String,
      trim: true,
      default: null,
    },
    mimeType: {
      type: String,
      trim: true,
      default: null,
    },
    sizeBytes: {
      type: Number,
      min: 0,
      default: 0,
    },
    errorMessage: {
      type: String,
      trim: true,
      default: null,
    },
    expiresAt: {
      type: Date,
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
  { timestamps: true }
);

exportJobSchema.index({ workspace: 1, deletedAt: 1, createdAt: -1 });
exportJobSchema.index({ expiresAt: 1, deletedAt: 1 });

const ExportJobModel = mongoose.model<ExportJobDocument>(
  "ExportJob",
  exportJobSchema
);

export default ExportJobModel;
