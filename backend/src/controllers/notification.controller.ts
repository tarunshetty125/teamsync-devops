import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { Permissions } from "../enums/role.enum";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { getMemberRoleInWorkspace } from "../services/member.service";
import {
  getNotificationPreferencesService,
  getUnreadNotificationCountService,
  listNotificationsService,
  markAllNotificationsReadService,
  markNotificationReadService,
  softDeleteNotificationService,
  updateNotificationPreferencesService,
} from "../services/notification.service";
import { buildRequestContext } from "../utils/request-context";
import { roleGuard } from "../utils/roleGuard";
import {
  notificationIdSchema,
  notificationListQuerySchema,
  notificationPreferencesSchema,
} from "../validation/notification.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

export const listNotificationsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const query = notificationListQuerySchema.parse(req.query);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await listNotificationsService(
      workspaceId,
      userId,
      {
        category: query.category,
        unreadOnly: query.unreadOnly,
      },
      {
        pageNumber: query.pageNumber,
        pageSize: query.pageSize,
      }
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Notifications fetched successfully",
      ...result,
    });
  }
);

export const getUnreadNotificationCountController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await getUnreadNotificationCountService(
      workspaceId,
      userId
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Unread notification count fetched successfully",
      ...result,
    });
  }
);

export const markNotificationReadController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const notificationId = notificationIdSchema.parse(req.params.notificationId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await markNotificationReadService(
      workspaceId,
      userId,
      notificationId
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Notification marked as read",
      ...result,
    });
  }
);

export const markAllNotificationsReadController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const result = await markAllNotificationsReadService(workspaceId, userId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Notifications marked as read",
      ...result,
    });
  }
);

export const deleteNotificationController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const notificationId = notificationIdSchema.parse(req.params.notificationId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.VIEW_ONLY]);

    const context = buildRequestContext(req, workspaceId);
    await softDeleteNotificationService(context, notificationId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Notification deleted successfully",
    });
  }
);

export const getNotificationPreferencesController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.MANAGE_NOTIFICATION_SETTINGS]);

    const result = await getNotificationPreferencesService(workspaceId, userId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Notification preferences fetched successfully",
      ...result,
    });
  }
);

export const updateNotificationPreferencesController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = notificationPreferencesSchema.parse(req.body);

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role, [Permissions.MANAGE_NOTIFICATION_SETTINGS]);

    const result = await updateNotificationPreferencesService(
      workspaceId,
      userId,
      body.preferences
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Notification preferences updated successfully",
      ...result,
    });
  }
);
