import mongoose, { Document, Schema } from "mongoose";
import {
  CommentTargetType,
  CommentTargetTypeEnum,
  DomainEntityType,
  DomainEntityTypeEnum,
} from "../enums/domain.enum";

export interface MentionDocument extends Document {
  workspace: mongoose.Types.ObjectId;
  mentionedUser: mongoose.Types.ObjectId;
  mentionedBy: mongoose.Types.ObjectId;
  sourceType: DomainEntityType;
  sourceId: mongoose.Types.ObjectId;
  targetType: CommentTargetType;
  targetId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const mentionSchema = new Schema<MentionDocument>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    mentionedUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mentionedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sourceType: {
      type: String,
      enum: Object.values(DomainEntityTypeEnum),
      required: true,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  }
);

mentionSchema.index({ mentionedUser: 1, createdAt: -1 });
mentionSchema.index({ workspace: 1, sourceType: 1, sourceId: 1 });
mentionSchema.index({ workspace: 1, targetType: 1, targetId: 1 });

const MentionModel = mongoose.model<MentionDocument>("Mention", mentionSchema);

export default MentionModel;
