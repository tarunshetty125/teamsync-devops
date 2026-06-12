import { Router } from "express";
import {
  deleteNotificationController,
  getNotificationPreferencesController,
  getUnreadNotificationCountController,
  listNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
  updateNotificationPreferencesController,
} from "../controllers/notification.controller";

const notificationRoutes = Router();

notificationRoutes.get("/workspace/:workspaceId", listNotificationsController);

notificationRoutes.get(
  "/workspace/:workspaceId/unread-count",
  getUnreadNotificationCountController
);

notificationRoutes.get(
  "/workspace/:workspaceId/settings",
  getNotificationPreferencesController
);

notificationRoutes.put(
  "/workspace/:workspaceId/settings",
  updateNotificationPreferencesController
);

notificationRoutes.put(
  "/workspace/:workspaceId/read-all",
  markAllNotificationsReadController
);

notificationRoutes.put(
  "/workspace/:workspaceId/:notificationId/read",
  markNotificationReadController
);

notificationRoutes.delete(
  "/workspace/:workspaceId/:notificationId",
  deleteNotificationController
);

export default notificationRoutes;
