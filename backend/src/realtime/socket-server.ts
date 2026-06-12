import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { config } from "../config/app.config";
import ProjectModel from "../models/project.model";
import TaskModel from "../models/task.model";
import { authenticateSocket } from "./socket-auth.middleware";
import { presenceRegistry } from "./presence.service";
import { projectRoom, taskRoom, userRoom, workspaceRoom } from "./realtime-rooms";
import { realtimeService } from "./realtime.service";
import { registerRealtimeEventHandlers } from "./realtime-event-handlers.service";
import { RealtimeAck, RealtimeServer, RealtimeSocket } from "./realtime.types";

const acknowledge = (ack: ((response: RealtimeAck) => void) | undefined) => ({
  ok: () => ack?.({ ok: true }),
  error: (message: string) => ack?.({ ok: false, error: message }),
});

const requireProjectAccess = async (socket: RealtimeSocket, projectId?: string) => {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  const project = await ProjectModel.findById(projectId).select("_id workspace").lean();

  if (!project) {
    throw new Error("Project not found");
  }

  const workspaceId = project.workspace.toString();

  if (!socket.data.identity.workspaceIds.includes(workspaceId)) {
    throw new Error("Not authorized for this project");
  }

  return {
    projectId: project._id.toString(),
    workspaceId,
  };
};

const requireTaskAccess = async (socket: RealtimeSocket, taskId?: string) => {
  if (!taskId) {
    throw new Error("taskId is required");
  }

  const task = await TaskModel.findById(taskId).select("_id workspace project").lean();

  if (!task) {
    throw new Error("Task not found");
  }

  const workspaceId = task.workspace.toString();

  if (!socket.data.identity.workspaceIds.includes(workspaceId)) {
    throw new Error("Not authorized for this task");
  }

  return {
    taskId: task._id.toString(),
    workspaceId,
    projectId: task.project.toString(),
  };
};

const registerRoomHandlers = (socket: RealtimeSocket) => {
  socket.on("project.join", async (payload, ack) => {
    const reply = acknowledge(ack);

    try {
      const { projectId } = await requireProjectAccess(socket, payload?.projectId);
      await socket.join(projectRoom(projectId));
      reply.ok();
    } catch (error) {
      reply.error(error instanceof Error ? error.message : "Project join failed");
    }
  });

  socket.on("project.leave", async (payload, ack) => {
    const reply = acknowledge(ack);

    if (payload?.projectId) {
      await socket.leave(projectRoom(payload.projectId));
    }

    reply.ok();
  });

  socket.on("task.join", async (payload, ack) => {
    const reply = acknowledge(ack);

    try {
      const { taskId } = await requireTaskAccess(socket, payload?.taskId);
      await socket.join(taskRoom(taskId));
      reply.ok();
    } catch (error) {
      reply.error(error instanceof Error ? error.message : "Task join failed");
    }
  });

  socket.on("task.leave", async (payload, ack) => {
    const reply = acknowledge(ack);

    if (payload?.taskId) {
      await socket.leave(taskRoom(payload.taskId));
    }

    reply.ok();
  });
};

const registerConnectionHandler = (io: RealtimeServer) => {
  io.on("connection", async (socket) => {
    const { userId, workspaceIds } = socket.data.identity;

    await socket.join(userRoom(userId));

    for (const workspaceId of workspaceIds) {
      await socket.join(workspaceRoom(workspaceId));
    }

    const onlineEvents = presenceRegistry.connect(socket.id, userId, workspaceIds);

    for (const event of onlineEvents) {
      realtimeService.emitUserOnline(event);
    }

    for (const workspaceId of workspaceIds) {
      realtimeService.emitPresenceSnapshot(socket, {
        workspaceId,
        onlineUserIds: presenceRegistry.getOnlineUserIds(workspaceId),
      });
    }

    registerRoomHandlers(socket);

    socket.on("disconnect", () => {
      const offlineEvents = presenceRegistry.disconnect(socket.id);

      for (const event of offlineEvents) {
        realtimeService.emitUserOffline(event);
      }
    });
  });
};

export const initializeRealtime = (httpServer: HttpServer) => {
  const io: RealtimeServer = new Server(httpServer, {
    cors: {
      origin: config.FRONTEND_ORIGINS,
      credentials: true,
    },
  });

  io.use(authenticateSocket);
  realtimeService.attach(io);
  registerRealtimeEventHandlers();
  registerConnectionHandler(io);

  return io;
};
