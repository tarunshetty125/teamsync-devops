import mongoose, { Document, Schema } from "mongoose";

export interface LabelDocument extends Document {
  workspace: mongoose.Types.ObjectId;
  name: string;
  color: string;
  description?: string | null;
  createdBy: mongoose.Types.ObjectId;
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const labelSchema = new Schema<LabelDocument>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
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

labelSchema.index({ workspace: 1, name: 1, deletedAt: 1 }, { unique: true });
labelSchema.index({ workspace: 1, deletedAt: 1, createdAt: -1 });

const LabelModel = mongoose.model<LabelDocument>("Label", labelSchema);

export default LabelModel;
