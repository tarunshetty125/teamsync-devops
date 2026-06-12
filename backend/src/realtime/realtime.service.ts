import {
  CommentRealtimePayload,
  NotificationRealtimePayload,
  PresenceRealtimePayload,
  PresenceSnapshotPayload,
  RealtimeServer,
  RealtimeSocket,
  TaskRealtimePayload,
} from "./realtime.types";
import { projectRoom, taskRoom, userRoom, workspaceRoom } from "./realtime-rooms";

class RealtimeService {
  private io: RealtimeServer | null = null;

  attach(io: RealtimeServer) {
    this.io = io;
  }

  detach() {
    this.io = null;
  }

  emitTaskCreated(payload: TaskRealtimePayload) {
    this.io
      ?.to(workspaceRoom(payload.workspaceId))
      .to(projectRoom(payload.projectId))
      .to(taskRoom(payload.taskId))
      .emit("task.created", payload);
  }

  emitTaskUpdated(payload: TaskRealtimePayload) {
    this.io
      ?.to(workspaceRoom(payload.workspaceId))
      .to(projectRoom(payload.projectId))
      .to(taskRoom(payload.taskId))
      .emit("task.updated", payload);
  }

  emitTaskDeleted(payload: TaskRealtimePayload) {
    this.io
      ?.to(workspaceRoom(payload.workspaceId))
      .to(projectRoom(payload.projectId))
      .to(taskRoom(payload.taskId))
      .emit("task.deleted", payload);
  }

  emitCommentCreated(payload: CommentRealtimePayload) {
    let target = this.io
      ?.to(workspaceRoom(payload.workspaceId))
      .to(projectRoom(payload.projectId));

    if (payload.taskId) {
      target = target?.to(taskRoom(payload.taskId));
    }

    target?.emit("comment.created", payload);
  }

  emitCommentUpdated(payload: CommentRealtimePayload) {
    let target = this.io
      ?.to(workspaceRoom(payload.workspaceId))
      .to(projectRoom(payload.projectId));

    if (payload.taskId) {
      target = target?.to(taskRoom(payload.taskId));
    }

    target?.emit("comment.updated", payload);
  }

  emitCommentDeleted(payload: CommentRealtimePayload) {
    let target = this.io
      ?.to(workspaceRoom(payload.workspaceId))
      .to(projectRoom(payload.projectId));

    if (payload.taskId) {
      target = target?.to(taskRoom(payload.taskId));
    }

    target?.emit("comment.deleted", payload);
  }

  emitNotificationCreated(payload: NotificationRealtimePayload) {
    this.io?.to(userRoom(payload.recipientId)).emit("notification.created", payload);
  }

  emitUserOnline(payload: PresenceRealtimePayload) {
    this.io?.to(workspaceRoom(payload.workspaceId)).emit("user.online", payload);
  }

  emitUserOffline(payload: PresenceRealtimePayload) {
    this.io?.to(workspaceRoom(payload.workspaceId)).emit("user.offline", payload);
  }

  emitPresenceSnapshot(socket: RealtimeSocket, payload: PresenceSnapshotPayload) {
    socket.emit("presence.snapshot", payload);
  }
}

export const realtimeService = new RealtimeService();
