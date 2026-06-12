import mongoose, { Document, Schema } from "mongoose";

export type RetentionDays = 90 | 180 | 365 | null;

export interface WorkspacePolicyDocument extends Document {
  workspace: mongoose.Types.ObjectId;
  comments: {
    allowEdit: boolean;
    allowDelete: boolean;
  };
  files: {
    maxUploadBytes: number;
    allowedMimeTypes: string[];
  };
  members: {
    allowSelfInvite: boolean;
    allowGuestInvite: boolean;
  };
  retention: {
    notificationsDays: RetentionDays;
    activityDays: RetentionDays;
    auditDays: RetentionDays;
    commentsDays: RetentionDays;
    filesDays: RetentionDays;
  };
  updatedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export const defaultWorkspacePolicy = {
  comments: {
    allowEdit: true,
    allowDelete: true,
  },
  files: {
    maxUploadBytes: 10 * 1024 * 1024,
    allowedMimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "application/pdf",
    ],
  },
  members: {
    allowSelfInvite: true,
    allowGuestInvite: false,
  },
  retention: {
    notificationsDays: null,
    activityDays: null,
    auditDays: null,
    commentsDays: null,
    filesDays: null,
  },
};

const retentionValue = {
  type: Number,
  enum: [90, 180, 365, null],
  default: null,
};

const workspacePolicySchema = new Schema<WorkspacePolicyDocument>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    comments: {
      allowEdit: { type: Boolean, default: defaultWorkspacePolicy.comments.allowEdit },
      allowDelete: {
        type: Boolean,
        default: defaultWorkspacePolicy.comments.allowDelete,
      },
    },
    files: {
      maxUploadBytes: {
        type: Number,
        min: 1,
        max: 50 * 1024 * 1024,
        default: defaultWorkspacePolicy.files.maxUploadBytes,
      },
      allowedMimeTypes: {
        type: [String],
        default: defaultWorkspacePolicy.files.allowedMimeTypes,
      },
    },
    members: {
      allowSelfInvite: {
        type: Boolean,
        default: defaultWorkspacePolicy.members.allowSelfInvite,
      },
      allowGuestInvite: {
        type: Boolean,
        default: defaultWorkspacePolicy.members.allowGuestInvite,
      },
    },
    retention: {
      notificationsDays: retentionValue,
      activityDays: retentionValue,
      auditDays: retentionValue,
      commentsDays: retentionValue,
      filesDays: retentionValue,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

workspacePolicySchema.index({ workspace: 1 }, { unique: true });

const WorkspacePolicyModel = mongoose.model<WorkspacePolicyDocument>(
  "WorkspacePolicy",
  workspacePolicySchema
);

export default WorkspacePolicyModel;
