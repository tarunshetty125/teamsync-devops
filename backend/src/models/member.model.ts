import mongoose, { Document, Schema } from "mongoose";
import { RoleDocument } from "./roles-permission.model";

interface MemberDocument extends Document {
  userId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  role: RoleDocument;
  joinedAt: Date;
  capacityHoursPerWeek: number;
  status: "ACTIVE" | "DEACTIVATED";
  deactivatedAt?: Date | null;
  deactivatedBy?: mongoose.Types.ObjectId | null;
  lastActiveAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const memberSchema = new Schema<MemberDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    role: {
      type: Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    capacityHoursPerWeek: {
      type: Number,
      min: 0,
      max: 168,
      default: 40,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "DEACTIVATED"],
      default: "ACTIVE",
      required: true,
    },
    deactivatedAt: {
      type: Date,
      default: null,
    },
    deactivatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

memberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
memberSchema.index({ userId: 1 });
memberSchema.index({ workspaceId: 1, role: 1 });
memberSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 });

const MemberModel = mongoose.model<MemberDocument>("Member", memberSchema);
export default MemberModel;
