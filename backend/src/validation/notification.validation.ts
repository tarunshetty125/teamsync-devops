import { z } from "zod";
import {
  NotificationCategory,
  NotificationCategoryEnum,
  NotificationType,
  NotificationTypeEnum,
} from "../enums/domain.enum";
import { objectIdSchema, paginationSchema } from "./common.validation";

export const notificationIdSchema = objectIdSchema("Notification ID");

export const notificationListQuerySchema = paginationSchema.extend({
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  category: z
    .enum(
      Object.values(NotificationCategoryEnum) as [
        NotificationCategory,
        ...NotificationCategory[]
      ]
    )
    .optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

const notificationPreferenceShape = Object.values(NotificationTypeEnum).reduce(
  (shape, type) => ({
    ...shape,
    [type]: z.boolean().optional(),
  }),
  {} as Record<NotificationType, z.ZodOptional<z.ZodBoolean>>
);

export const notificationPreferencesSchema = z.object({
  preferences: z.object(notificationPreferenceShape).strict(),
});
