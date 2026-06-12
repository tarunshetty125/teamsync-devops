import mongoose, { Document, Schema } from "mongoose";

export interface SessionRecordDocument extends Document {
  sessionIdHash: string;
  user: mongoose.Types.ObjectId;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  revokedAt?: Date | null;
  revokedBy?: mongoose.Types.ObjectId | null;
  ipAddress: string;
  userAgent: string;
}

const sessionRecordSchema = new Schema<SessionRecordDocument>(
  {
    sessionIdHash: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastActiveAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    ipAddress: {
      type: String,
      required: true,
      trim: true,
    },
    userAgent: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

sessionRecordSchema.index({ user: 1, revokedAt: 1, lastActiveAt: -1 });
sessionRecordSchema.index({ expiresAt: 1 });

const SessionRecordModel = mongoose.model<SessionRecordDocument>(
  "SessionRecord",
  sessionRecordSchema
);

export default SessionRecordModel;
