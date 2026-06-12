import mongoose, { Document, Schema } from "mongoose";

export interface MigrationRecordDocument extends Document {
  name: string;
  checksum: string;
  appliedAt: Date;
  durationMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const migrationRecordSchema = new Schema<MigrationRecordDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    checksum: {
      type: String,
      required: true,
      trim: true,
    },
    appliedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    durationMs: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

migrationRecordSchema.index({ name: 1 }, { unique: true });

const MigrationRecordModel = mongoose.model<MigrationRecordDocument>(
  "MigrationRecord",
  migrationRecordSchema
);

export default MigrationRecordModel;
