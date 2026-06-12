import mongoose, { Document, Schema } from "mongoose";
import {
  NotificationType,
  NotificationTypeEnum,
} from "../enums/domain.enum";

export type NotificationPreferenceMap = Partial<
  Record<NotificationType, boolean>
>;

export interface NotificationPreferenceDocument extends Document {
  workspace: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  preferences: NotificationPreferenceMap;
  createdAt: Date;
  updatedAt: Date;
}

const notificationPreferenceSchema =
  new Schema<NotificationPreferenceDocument>(
    {
      workspace: {
        type: Schema.Types.ObjectId,
        ref: "Workspace",
        required: true,
      },
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      preferences: {
        type: Schema.Types.Mixed,
        default: {},
      },
    },
    {
      timestamps: true,
    }
  );

notificationPreferenceSchema.path("preferences").validate((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.keys(value).every((key) =>
    Object.values(NotificationTypeEnum).includes(key as NotificationType)
  );
}, "Notification preferences contain an unsupported notification type");

notificationPreferenceSchema.index({ workspace: 1, user: 1 }, { unique: true });
notificationPreferenceSchema.index({ user: 1, updatedAt: -1 });

const NotificationPreferenceModel =
  mongoose.model<NotificationPreferenceDocument>(
    "NotificationPreference",
    notificationPreferenceSchema
  );

export default NotificationPreferenceModel;
