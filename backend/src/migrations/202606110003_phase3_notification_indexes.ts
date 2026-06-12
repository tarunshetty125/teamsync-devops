import {
  NotificationCategoryEnum,
  NotificationTypeEnum,
} from "../enums/domain.enum";
import NotificationPreferenceModel from "../models/notification-preference.model";
import NotificationModel from "../models/notification.model";
import { Migration } from "./types";

const categoryByType = {
  [NotificationTypeEnum.TASK_ASSIGNED]: NotificationCategoryEnum.TASK,
  [NotificationTypeEnum.COMMENT_ADDED]: NotificationCategoryEnum.COMMENT,
  [NotificationTypeEnum.MENTION_RECEIVED]: NotificationCategoryEnum.COMMENT,
  [NotificationTypeEnum.PROJECT_CREATED]: NotificationCategoryEnum.PROJECT,
  [NotificationTypeEnum.INVITE_ACCEPTED]: NotificationCategoryEnum.INVITE,
  [NotificationTypeEnum.FILE_UPLOADED]: NotificationCategoryEnum.SYSTEM,
};

export const phase3NotificationIndexesMigration: Migration = {
  name: "202606110003_phase3_notification_indexes",
  up: async () => {
    await Promise.all(
      Object.entries(categoryByType).map(([type, category]) =>
        NotificationModel.updateMany(
          {
            type,
            category: { $exists: false },
          },
          {
            $set: { category },
          }
        )
      )
    );

    await Promise.all([
      NotificationModel.createIndexes(),
      NotificationPreferenceModel.createIndexes(),
    ]);
  },
  down: async () => {
    // Index rollback is intentionally a no-op so later deployments cannot
    // accidentally remove indexes relied on by production notification reads.
  },
};
