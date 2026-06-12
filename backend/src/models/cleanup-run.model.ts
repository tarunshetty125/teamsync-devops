import mongoose, { Document, Schema } from "mongoose";

export interface CleanupRunDocument extends Document {
  name: string;
  lockedUntil?: Date | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  status: "IDLE" | "RUNNING" | "COMPLETED" | "FAILED";
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const cleanupRunSchema = new Schema<CleanupRunDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["IDLE", "RUNNING", "COMPLETED", "FAILED"],
      default: "IDLE",
      required: true,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const CleanupRunModel = mongoose.model<CleanupRunDocument>(
  "CleanupRun",
  cleanupRunSchema
);

export default CleanupRunModel;
