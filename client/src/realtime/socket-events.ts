export type TaskRealtimePayload = {
  taskId: string;
  workspaceId: string;
  projectId: string;
  changedFields?: string[];
  timestamp: string;
};

export type CommentRealtimePayload = {
  commentId: string;
  workspaceId: string;
  projectId: string;
  taskId?: string | null;
  timestamp: string;
};

export type NotificationRealtimePayload = {
  notificationId: string;
  recipientId: string;
  category: string;
  timestamp: string;
};

export type PresenceRealtimePayload = {
  userId: string;
  workspaceId: string;
  timestamp: string;
};

export type PresenceSnapshotPayload = {
  workspaceId: string;
  onlineUserIds: string[];
};

export type RealtimeAck = {
  ok: boolean;
  error?: string;
};

export type ServerToClientEvents = {
  "task.created": (payload: TaskRealtimePayload) => void;
  "task.updated": (payload: TaskRealtimePayload) => void;
  "task.deleted": (payload: TaskRealtimePayload) => void;
  "comment.created": (payload: CommentRealtimePayload) => void;
  "comment.updated": (payload: CommentRealtimePayload) => void;
  "comment.deleted": (payload: CommentRealtimePayload) => void;
  "notification.created": (payload: NotificationRealtimePayload) => void;
  "user.online": (payload: PresenceRealtimePayload) => void;
  "user.offline": (payload: PresenceRealtimePayload) => void;
  "presence.snapshot": (payload: PresenceSnapshotPayload) => void;
};

export type ClientToServerEvents = {
  "project.join": (
    payload: { projectId: string },
    ack?: (response: RealtimeAck) => void
  ) => void;
  "project.leave": (
    payload: { projectId: string },
    ack?: (response: RealtimeAck) => void
  ) => void;
  "task.join": (
    payload: { taskId: string },
    ack?: (response: RealtimeAck) => void
  ) => void;
  "task.leave": (
    payload: { taskId: string },
    ack?: (response: RealtimeAck) => void
  ) => void;
};
