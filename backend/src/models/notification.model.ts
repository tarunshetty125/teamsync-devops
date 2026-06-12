import mongoose, { Document, Schema } from "mongoose";
import {
  DomainEntityType,
  DomainEntityTypeEnum,
  NotificationCategory,
  NotificationCategoryEnum,
  NotificationType,
  NotificationTypeEnum,
} from "../enums/domain.enum";

export interface NotificationDocument extends Document {
  workspace: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  actor?: mongoose.Types.ObjectId | null;
  type: NotificationType;
  category: NotificationCategory;
  entityType: DomainEntityType;
  entityId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  dedupeKey?: string | null;
  readAt?: Date | null;
  metadata?: Record<string, unknown>;
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: Object.values(NotificationTypeEnum),
      required: true,
    },
    category: {
      type: String,
      enum: Object.values(NotificationCategoryEnum),
      required: true,
    },
    entityType: {
      type: String,
      enum: Object.values(DomainEntityTypeEnum),
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    dedupeKey: {
      type: String,
      trim: true,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
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

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ workspace: 1, createdAt: -1 });
notificationSchema.index({ workspace: 1, deletedAt: 1, createdAt: -1 });
notificationSchema.index({
  workspace: 1,
  recipient: 1,
  deletedAt: 1,
  readAt: 1,
  createdAt: -1,
});
notificationSchema.index(
  { workspace: 1, recipient: 1, dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: "string" } },
  }
);

const NotificationModel = mongoose.model<NotificationDocument>(
  "Notification",
  notificationSchema
);

export default NotificationModel;
