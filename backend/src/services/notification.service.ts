import mongoose from "mongoose";
import {
  DomainEntityType,
  DomainEntityTypeEnum,
  DomainEventTypeEnum,
  NotificationCategory,
  NotificationCategoryEnum,
  NotificationType,
  NotificationTypeEnum,
} from "../enums/domain.enum";
import MemberModel from "../models/member.model";
import NotificationPreferenceModel, {
  NotificationPreferenceMap,
} from "../models/notification-preference.model";
import NotificationModel, {
  NotificationDocument,
} from "../models/notification.model";
import { RequestContext } from "../types/request-context";
import { ForbiddenException, NotFoundException } from "../utils/appError";
import { emitDomainEvent } from "./domain-event.service";

type CreateNotificationInput = {
  recipientId: string;
  type: NotificationType;
  category?: NotificationCategory;
  entityType: DomainEntityType;
  entityId: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
};

type PaginationInput = {
  pageSize: number;
  pageNumber: number;
};

type NotificationFilters = {
  category?: NotificationCategory;
  unreadOnly?: boolean;
};

type CreateNotificationOptions = {
  respectPreferences?: boolean;
  validateRecipientMembership?: boolean;
  skipSelf?: boolean;
  emitCreatedEvent?: boolean;
};

export const activeNotificationTypes = Object.values(NotificationTypeEnum);

export const defaultNotificationPreferences: Record<
  NotificationType,
  boolean
> = activeNotificationTypes.reduce(
  (preferences, type) => ({
    ...preferences,
    [type]: true,
  }),
  {} as Record<NotificationType, boolean>
);

const defaultCategoryByType: Record<NotificationType, NotificationCategory> = {
  [NotificationTypeEnum.TASK_ASSIGNED]: NotificationCategoryEnum.TASK,
  [NotificationTypeEnum.COMMENT_ADDED]: NotificationCategoryEnum.COMMENT,
  [NotificationTypeEnum.MENTION_RECEIVED]: NotificationCategoryEnum.COMMENT,
  [NotificationTypeEnum.PROJECT_CREATED]: NotificationCategoryEnum.PROJECT,
  [NotificationTypeEnum.INVITE_ACCEPTED]: NotificationCategoryEnum.INVITE,
  [NotificationTypeEnum.FILE_UPLOADED]: NotificationCategoryEnum.SYSTEM,
  [NotificationTypeEnum.TASK_UPDATED]: NotificationCategoryEnum.TASK,
};

const getObjectId = (id: string) => new mongoose.Types.ObjectId(id);

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const normalizePreferences = (
  preferences?: NotificationPreferenceMap
): Record<NotificationType, boolean> => {
  const normalized = { ...defaultNotificationPreferences };

  if (!preferences) {
    return normalized;
  }

  for (const type of activeNotificationTypes) {
    if (typeof preferences[type] === "boolean") {
      normalized[type] = Boolean(preferences[type]);
    }
  }

  return normalized;
};

const serializeNotification = (notification: NotificationDocument) => ({
  _id: notification._id.toString(),
  workspace: notification.workspace.toString(),
  recipient: notification.recipient.toString(),
  actor: notification.actor ? notification.actor.toString() : null,
  type: notification.type,
  category: notification.category,
  entityType: notification.entityType,
  entityId: notification.entityId.toString(),
  title: notification.title,
  body: notification.body,
  readAt: notification.readAt ?? null,
  metadata: notification.metadata,
  deletedAt: notification.deletedAt ?? null,
  deletedBy: notification.deletedBy?.toString() ?? null,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
});

const ensureRecipientMembership = async (
  workspaceId: string,
  recipientId: string
) => {
  const membership = await MemberModel.exists({
    workspaceId,
    userId: recipientId,
  });

  if (!membership) {
    throw new ForbiddenException(
      "Notification recipient must belong to the workspace"
    );
  }
};

export const getNotificationPreferencesService = async (
  workspaceId: string,
  userId: string
) => {
  const preference = await NotificationPreferenceModel.findOne({
    workspace: workspaceId,
    user: userId,
  });

  return {
    preferences: normalizePreferences(preference?.preferences),
  };
};

export const updateNotificationPreferencesService = async (
  workspaceId: string,
  userId: string,
  preferences: NotificationPreferenceMap
) => {
  const existing = await NotificationPreferenceModel.findOne({
    workspace: workspaceId,
    user: userId,
  });
  const merged = normalizePreferences({
    ...(existing?.preferences || {}),
    ...preferences,
  });

  const updated = await NotificationPreferenceModel.findOneAndUpdate(
    {
      workspace: workspaceId,
      user: userId,
    },
    {
      $set: {
        preferences: merged,
      },
      $setOnInsert: {
        workspace: getObjectId(workspaceId),
        user: getObjectId(userId),
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
    }
  );

  return {
    preferences: normalizePreferences(updated?.preferences),
  };
};

const notificationEnabledForRecipient = async (
  workspaceId: string,
  recipientId: string,
  type: NotificationType
) => {
  const { preferences } = await getNotificationPreferencesService(
    workspaceId,
    recipientId
  );

  return preferences[type] !== false;
};

export const createNotificationRecord = async (
  context: RequestContext,
  input: CreateNotificationInput,
  options: CreateNotificationOptions = {}
) => {
  const {
    respectPreferences = true,
    validateRecipientMembership = true,
    skipSelf = true,
    emitCreatedEvent = true,
  } = options;

  if (skipSelf && input.recipientId === context.userId) {
    return { notification: null, created: false, skippedReason: "self" };
  }

  if (validateRecipientMembership) {
    await ensureRecipientMembership(context.workspaceId, input.recipientId);
  }

  if (
    respectPreferences &&
    !(await notificationEnabledForRecipient(
      context.workspaceId,
      input.recipientId,
      input.type
    ))
  ) {
    return { notification: null, created: false, skippedReason: "preference" };
  }

  try {
    const notification = await NotificationModel.create({
      workspace: getObjectId(context.workspaceId),
      recipient: getObjectId(input.recipientId),
      actor: getObjectId(context.userId),
      type: input.type,
      category: input.category || defaultCategoryByType[input.type],
      entityType: input.entityType,
      entityId: getObjectId(input.entityId),
      title: input.title,
      body: input.body,
      dedupeKey: input.dedupeKey || null,
      metadata: input.metadata,
    });

    if (emitCreatedEvent) {
      await emitDomainEvent({
        type: DomainEventTypeEnum.NOTIFICATION_CREATED,
        context,
        entityType: DomainEntityTypeEnum.NOTIFICATION,
        entityId: notification._id.toString(),
        target: {
          type: input.entityType,
          id: input.entityId,
        },
        metadata: {
          notificationType: input.type,
          category: notification.category,
          recipientId: input.recipientId,
        },
        occurredAt: new Date(),
      });
    }

    return {
      notification: serializeNotification(notification),
      created: true,
      skippedReason: null,
    };
  } catch (error) {
    if (!isDuplicateKeyError(error) || !input.dedupeKey) {
      throw error;
    }

    const existing = await NotificationModel.findOne({
      workspace: context.workspaceId,
      recipient: input.recipientId,
      dedupeKey: input.dedupeKey,
    });

    return {
      notification: existing ? serializeNotification(existing) : null,
      created: false,
      skippedReason: "duplicate",
    };
  }
};

export const createDraftNotificationRecord = async (
  context: RequestContext,
  input: CreateNotificationInput
) =>
  createNotificationRecord(context, input, {
    respectPreferences: false,
    validateRecipientMembership: false,
    skipSelf: false,
    emitCreatedEvent: false,
  });

export const createNotificationsForRecipients = async (
  context: RequestContext,
  recipientIds: string[],
  input: Omit<CreateNotificationInput, "recipientId" | "dedupeKey"> & {
    dedupeKeyForRecipient?: (recipientId: string) => string;
  }
) => {
  const uniqueRecipientIds = Array.from(new Set(recipientIds.filter(Boolean)));
  const results = [];

  for (const recipientId of uniqueRecipientIds) {
    try {
      results.push(
        await createNotificationRecord(context, {
          ...input,
          recipientId,
          dedupeKey: input.dedupeKeyForRecipient?.(recipientId),
        })
      );
    } catch (error) {
      results.push({
        notification: null,
        created: false,
        skippedReason: "error",
        error,
      });
    }
  }

  return results;
};

export const listNotificationsService = async (
  workspaceId: string,
  userId: string,
  filters: NotificationFilters,
  pagination: PaginationInput
) => {
  const { pageNumber, pageSize } = pagination;
  const skip = (pageNumber - 1) * pageSize;
  const query: Record<string, unknown> = {
    workspace: getObjectId(workspaceId),
    recipient: getObjectId(userId),
    deletedAt: null,
  };

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.unreadOnly) {
    query.readAt = null;
  }

  const [notifications, totalCount] = await Promise.all([
    NotificationModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    NotificationModel.countDocuments(query),
  ]);

  return {
    notifications: notifications.map(serializeNotification),
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      skip,
      limit: pageSize,
    },
  };
};

export const getUnreadNotificationCountService = async (
  workspaceId: string,
  userId: string
) => {
  const unreadCount = await NotificationModel.countDocuments({
    workspace: workspaceId,
    recipient: userId,
    deletedAt: null,
    readAt: null,
  });

  return { unreadCount };
};

export const markNotificationReadService = async (
  workspaceId: string,
  userId: string,
  notificationId: string
) => {
  const notification = await NotificationModel.findOneAndUpdate(
    {
      _id: notificationId,
      workspace: workspaceId,
      recipient: userId,
      deletedAt: null,
    },
    {
      $set: {
        readAt: new Date(),
      },
    },
    {
      new: true,
    }
  );

  if (!notification) {
    throw new NotFoundException("Notification not found");
  }

  return { notification: serializeNotification(notification) };
};

export const markAllNotificationsReadService = async (
  workspaceId: string,
  userId: string
) => {
  const result = await NotificationModel.updateMany(
    {
      workspace: workspaceId,
      recipient: userId,
      deletedAt: null,
      readAt: null,
    },
    {
      $set: {
        readAt: new Date(),
      },
    }
  );

  return { modifiedCount: result.modifiedCount };
};

export const softDeleteNotificationService = async (
  context: RequestContext,
  notificationId: string
) => {
  const notification = await NotificationModel.findOneAndUpdate(
    {
      _id: notificationId,
      workspace: context.workspaceId,
      recipient: context.userId,
      deletedAt: null,
    },
    {
      $set: {
        deletedAt: new Date(),
        deletedBy: getObjectId(context.userId),
      },
    },
    {
      new: true,
    }
  );

  if (!notification) {
    throw new NotFoundException("Notification not found");
  }

  return { notification: serializeNotification(notification) };
};
