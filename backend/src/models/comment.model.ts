import mongoose, { Document, Schema } from "mongoose";
import {
  CommentTargetType,
  CommentTargetTypeEnum,
} from "../enums/domain.enum";

export interface CommentDocument extends Document {
  workspace: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  targetType: CommentTargetType;
  targetId: mongoose.Types.ObjectId;
  parentComment?: mongoose.Types.ObjectId | null;
  bodyJson: Record<string, unknown>;
  plainText: string;
  mentions: mongoose.Types.ObjectId[];
  editedAt?: Date | null;
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<CommentDocument>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: {
      type: String,
      enum: Object.values(CommentTargetTypeEnum),
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    bodyJson: {
      type: Schema.Types.Mixed,
      required: true,
    },
    plainText: {
      type: String,
      required: true,
      trim: true,
    },
    mentions: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    editedAt: {
      type: Date,
      default: null,
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

commentSchema.index({
  workspace: 1,
  targetType: 1,
  targetId: 1,
  deletedAt: 1,
  createdAt: -1,
});
commentSchema.index({
  workspace: 1,
  parentComment: 1,
  deletedAt: 1,
  createdAt: 1,
});
commentSchema.index({
  workspace: 1,
  author: 1,
  deletedAt: 1,
  createdAt: -1,
});
commentSchema.index(
  {
    workspace: 1,
    deletedAt: 1,
    plainText: "text",
  },
  {
    name: "comment_workspace_text",
    weights: {
      plainText: 10,
    },
  }
);

const CommentModel = mongoose.model<CommentDocument>("Comment", commentSchema);

export default CommentModel;
