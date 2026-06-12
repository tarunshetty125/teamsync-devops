import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { useAuthContext } from "@/context/auth-provider";
import useWorkspaceId from "@/hooks/use-workspace-id";
import {
  CommentRealtimePayload,
  PresenceRealtimePayload,
  PresenceSnapshotPayload,
  TaskRealtimePayload,
} from "./socket-events";
import { SocketContext, TeamSyncSocket } from "./socket-context";

const getRealtimeUrl = () => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

  if (!apiBaseUrl) {
    return window.location.origin;
  }

  try {
    const url = new URL(apiBaseUrl, window.location.origin);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return window.location.origin;
  }
};

const emitWithAck = (
  socket: TeamSyncSocket | null,
  event: "project.join" | "project.leave",
  payload: { projectId: string }
) => {
  socket?.emit(event, payload, () => undefined);
};

const emitTaskWithAck = (
  socket: TeamSyncSocket | null,
  event: "task.join" | "task.leave",
  payload: { taskId: string }
) => {
  socket?.emit(event, payload, () => undefined);
};

export function SocketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const workspaceId = useWorkspaceId();
  const workspaceIdRef = useRef(workspaceId);
  const socketRef = useRef<TeamSyncSocket | null>(null);
  const projectRoomsRef = useRef(new Set<string>());
  const taskRoomsRef = useRef(new Set<string>());
  const [socket, setSocket] = useState<TeamSyncSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineByWorkspace, setOnlineByWorkspace] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  useEffect(() => {
    if (!user?._id) {
      return;
    }

    const nextSocket: TeamSyncSocket = io(getRealtimeUrl(), {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    const projectRooms = projectRoomsRef.current;
    const taskRooms = taskRoomsRef.current;

    socketRef.current = nextSocket;
    setSocket(nextSocket);

    const invalidateTaskQueries = (payload: TaskRealtimePayload) => {
      queryClient.invalidateQueries({
        queryKey: ["all-tasks", payload.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["kanban-tasks", payload.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: [
          "task-details",
          payload.workspaceId,
          payload.projectId,
          payload.taskId,
        ],
      });
      queryClient.invalidateQueries({
        queryKey: ["project-analytics", payload.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspace-analytics", payload.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["dashboard", payload.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["timeline", payload.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["roadmap", payload.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["gantt", payload.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["milestones", payload.workspaceId],
      });
    };

    const invalidateCommentQueries = (payload: CommentRealtimePayload) => {
      queryClient.invalidateQueries({
        queryKey: ["comments", payload.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["activity", payload.workspaceId],
      });
    };

    const invalidateNotificationQueries = () => {
      const activeWorkspaceId = workspaceIdRef.current;

      queryClient.invalidateQueries({
        queryKey: ["notifications", activeWorkspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["notifications-unread-count", activeWorkspaceId],
      });
    };

    const applyPresenceSnapshot = (payload: PresenceSnapshotPayload) => {
      setOnlineByWorkspace((current) => ({
        ...current,
        [payload.workspaceId]: payload.onlineUserIds,
      }));
      queryClient.invalidateQueries({ queryKey: ["members", payload.workspaceId] });
    };

    const applyUserOnline = (payload: PresenceRealtimePayload) => {
      setOnlineByWorkspace((current) => {
        const existing = current[payload.workspaceId] || [];
        if (existing.includes(payload.userId)) {
          return current;
        }

        return {
          ...current,
          [payload.workspaceId]: [...existing, payload.userId],
        };
      });
      queryClient.invalidateQueries({ queryKey: ["members", payload.workspaceId] });
    };

    const applyUserOffline = (payload: PresenceRealtimePayload) => {
      setOnlineByWorkspace((current) => ({
        ...current,
        [payload.workspaceId]: (current[payload.workspaceId] || []).filter(
          (userId) => userId !== payload.userId
        ),
      }));
      queryClient.invalidateQueries({ queryKey: ["members", payload.workspaceId] });
    };

    const handleConnect = () => {
      setIsConnected(true);
      projectRoomsRef.current.forEach((projectId) =>
        emitWithAck(nextSocket, "project.join", { projectId })
      );
      taskRoomsRef.current.forEach((taskId) =>
        emitTaskWithAck(nextSocket, "task.join", { taskId })
      );
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    nextSocket.on("connect", handleConnect);
    nextSocket.on("disconnect", handleDisconnect);
    nextSocket.on("task.created", invalidateTaskQueries);
    nextSocket.on("task.updated", invalidateTaskQueries);
    nextSocket.on("task.deleted", invalidateTaskQueries);
    nextSocket.on("comment.created", invalidateCommentQueries);
    nextSocket.on("comment.updated", invalidateCommentQueries);
    nextSocket.on("comment.deleted", invalidateCommentQueries);
    nextSocket.on("notification.created", invalidateNotificationQueries);
    nextSocket.on("presence.snapshot", applyPresenceSnapshot);
    nextSocket.on("user.online", applyUserOnline);
    nextSocket.on("user.offline", applyUserOffline);

    return () => {
      nextSocket.off("connect", handleConnect);
      nextSocket.off("disconnect", handleDisconnect);
      nextSocket.off("task.created", invalidateTaskQueries);
      nextSocket.off("task.updated", invalidateTaskQueries);
      nextSocket.off("task.deleted", invalidateTaskQueries);
      nextSocket.off("comment.created", invalidateCommentQueries);
      nextSocket.off("comment.updated", invalidateCommentQueries);
      nextSocket.off("comment.deleted", invalidateCommentQueries);
      nextSocket.off("notification.created", invalidateNotificationQueries);
      nextSocket.off("presence.snapshot", applyPresenceSnapshot);
      nextSocket.off("user.online", applyUserOnline);
      nextSocket.off("user.offline", applyUserOffline);
      nextSocket.disconnect();
      socketRef.current = null;
      projectRooms.clear();
      taskRooms.clear();
      setSocket(null);
      setIsConnected(false);
      setOnlineByWorkspace({});
    };
  }, [queryClient, user?._id]);

  const joinProject = useCallback((projectId: string) => {
    if (!projectId) return;
    projectRoomsRef.current.add(projectId);
    emitWithAck(socketRef.current, "project.join", { projectId });
  }, []);

  const leaveProject = useCallback((projectId: string) => {
    if (!projectId) return;
    projectRoomsRef.current.delete(projectId);
    emitWithAck(socketRef.current, "project.leave", { projectId });
  }, []);

  const joinTask = useCallback((taskId: string) => {
    if (!taskId) return;
    taskRoomsRef.current.add(taskId);
    emitTaskWithAck(socketRef.current, "task.join", { taskId });
  }, []);

  const leaveTask = useCallback((taskId: string) => {
    if (!taskId) return;
    taskRoomsRef.current.delete(taskId);
    emitTaskWithAck(socketRef.current, "task.leave", { taskId });
  }, []);

  const onlineUserIds = useMemo(
    () => onlineByWorkspace[workspaceId] || [],
    [onlineByWorkspace, workspaceId]
  );

  const isUserOnline = useCallback(
    (userId?: string | null) => Boolean(userId && onlineUserIds.includes(userId)),
    [onlineUserIds]
  );

  const value = useMemo(
    () => ({
      socket,
      isConnected,
      onlineUserIds,
      isUserOnline,
      joinProject,
      leaveProject,
      joinTask,
      leaveTask,
    }),
    [
      socket,
      isConnected,
      onlineUserIds,
      isUserOnline,
      joinProject,
      leaveProject,
      joinTask,
      leaveTask,
    ]
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}
