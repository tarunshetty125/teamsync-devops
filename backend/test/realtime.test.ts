import { createServer, Server as HttpServer } from "http";
import { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { io as createClient, Socket as ClientSocket } from "socket.io-client";
import app from "../src/app";
import {
  DomainEntityTypeEnum,
  DomainEventTypeEnum,
  NotificationCategoryEnum,
} from "../src/enums/domain.enum";
import { Roles } from "../src/enums/role.enum";
import { TaskPriorityEnum, TaskStatusEnum } from "../src/enums/task.enum";
import MemberModel from "../src/models/member.model";
import RoleModel from "../src/models/roles-permission.model";
import { registerUserService } from "../src/services/auth.service";
import {
  clearDomainEventHandlersForTest,
  emitDomainEvent,
} from "../src/services/domain-event.service";
import { createProjectService } from "../src/services/project.service";
import { createTaskService } from "../src/services/task.service";
import { resetRealtimeEventHandlersForTest } from "../src/realtime/realtime-event-handlers.service";
import { initializeRealtime } from "../src/realtime/socket-server";
import { presenceRegistry } from "../src/realtime/presence.service";
import { realtimeService } from "../src/realtime/realtime.service";
import { RealtimeServer } from "../src/realtime/realtime.types";
import { RequestContext } from "../src/types/request-context";

const password = "Str0ng!Pass";

let httpServer: HttpServer;
let ioServer: RealtimeServer;
let baseUrl: string;
let sockets: ClientSocket[] = [];

const contextFor = (
  userId: string,
  workspaceId: string,
  requestId = `${userId}-${workspaceId}`
): RequestContext => ({
  requestId,
  userId,
  workspaceId,
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
});

const registerUser = async (email: string, name: string) => {
  const result = await registerUserService({
    email,
    name,
    password,
  });

  return {
    userId: result.userId.toString(),
    workspaceId: result.workspaceId.toString(),
  };
};

const addMemberToWorkspace = async (
  userId: string,
  workspaceId: string,
  roleName = Roles.MEMBER
) => {
  const role = await RoleModel.findOne({ name: roleName });

  if (!role) {
    throw new Error(`Expected ${roleName} role to exist`);
  }

  await MemberModel.create({
    userId,
    workspaceId,
    role: role._id,
  });
};

const getCookieHeader = (headers: Headers) => {
  const headersWithCookies = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookieHeaders =
    headersWithCookies.getSetCookie?.() ||
    (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);

  return setCookieHeaders
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
};

const loginCookieFor = async (email: string) => {
  const response = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  expect(response.status).toBe(200);
  const cookie = getCookieHeader(response.headers);
  expect(cookie).toContain("teamsync.sid");
  return cookie;
};

const makeSocket = (cookie?: string) => {
  const socket = createClient(baseUrl, {
    autoConnect: false,
    forceNew: true,
    reconnection: false,
    transports: ["websocket"],
    extraHeaders: cookie ? { Cookie: cookie } : undefined,
  });

  sockets.push(socket);
  return socket;
};

const connectSocket = async (cookie: string) => {
  const socket = makeSocket(cookie);
  const connectPromise = new Promise<ClientSocket>((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });

  socket.connect();
  return connectPromise;
};

const expectConnectError = async (socket: ClientSocket) => {
  const errorPromise = new Promise<Error>((resolve) => {
    socket.once("connect_error", resolve);
  });

  socket.connect();
  return errorPromise;
};

const waitForEvent = <T>(socket: ClientSocket, event: string) =>
  new Promise<T>((resolve) => {
    socket.once(event, (payload: T) => resolve(payload));
  });

const waitForPresence = (
  socket: ClientSocket,
  event: "user.online" | "user.offline",
  userId: string
) =>
  new Promise<{ userId: string; workspaceId: string; timestamp: string }>(
    (resolve) => {
      const handler = (payload: {
        userId: string;
        workspaceId: string;
        timestamp: string;
      }) => {
        if (payload.userId === userId) {
          socket.off(event, handler);
          resolve(payload);
        }
      };

      socket.on(event, handler);
    }
  );

const expectNoPresence = async (
  socket: ClientSocket,
  event: "user.online" | "user.offline",
  userId: string
) => {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, 100);
    const handler = (payload: { userId: string }) => {
      if (payload.userId === userId) {
        clearTimeout(timer);
        socket.off(event, handler);
        reject(new Error(`Unexpected ${event}`));
      }
    };

    socket.on(event, handler);
  });
};

const expectNoEvent = async (socket: ClientSocket, event: string) => {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, 100);
    const handler = () => {
      clearTimeout(timer);
      socket.off(event, handler);
      reject(new Error(`Unexpected ${event}`));
    };

    socket.on(event, handler);
  });
};

const emitWithAck = (
  socket: ClientSocket,
  event: "project.join" | "task.join",
  payload: Record<string, string>
) =>
  new Promise<{ ok: boolean; error?: string }>((resolve) => {
    socket.emit(event, payload, resolve);
  });

beforeEach(async () => {
  clearDomainEventHandlersForTest();
  resetRealtimeEventHandlersForTest();
  presenceRegistry.resetForTest();

  httpServer = createServer(app);
  ioServer = initializeRealtime(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });

  const address = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  sockets.forEach((socket) => socket.disconnect());
  sockets = [];
  ioServer.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  realtimeService.detach();
  clearDomainEventHandlersForTest();
  resetRealtimeEventHandlersForTest();
  presenceRegistry.resetForTest();
});

describe("realtime collaboration", () => {
  it("rejects unauthenticated sockets and accepts session-authenticated sockets", async () => {
    const owner = await registerUser("rt-auth-owner@example.com", "RT Owner");
    const cookie = await loginCookieFor("rt-auth-owner@example.com");
    const unauthenticated = makeSocket();

    await expect(expectConnectError(unauthenticated)).resolves.toBeTruthy();

    const socket = makeSocket(cookie);
    const snapshotPromise = waitForEvent<{
      workspaceId: string;
      onlineUserIds: string[];
    }>(socket, "presence.snapshot");
    const connectPromise = new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("connect_error", reject);
    });

    socket.connect();
    await connectPromise;

    const snapshot = await snapshotPromise;
    expect(snapshot.workspaceId).toBe(owner.workspaceId);
    expect(snapshot.onlineUserIds).toContain(owner.userId);
  });

  it("validates project and task room joins and keeps joins idempotent", async () => {
    const owner = await registerUser("rt-room-owner@example.com", "Room Owner");
    const outsider = await registerUser(
      "rt-room-outsider@example.com",
      "Room Outsider"
    );
    const { project } = await createProjectService(
      owner.userId,
      owner.workspaceId,
      { name: "Realtime Rooms" }
    );
    const { task } = await createTaskService(
      owner.workspaceId,
      project._id.toString(),
      owner.userId,
      {
        title: "Room Task",
        priority: TaskPriorityEnum.MEDIUM,
        status: TaskStatusEnum.TODO,
      }
    );

    const ownerSocket = await connectSocket(
      await loginCookieFor("rt-room-owner@example.com")
    );
    const outsiderSocket = await connectSocket(
      await loginCookieFor("rt-room-outsider@example.com")
    );

    await expect(
      emitWithAck(ownerSocket, "project.join", {
        projectId: project._id.toString(),
      })
    ).resolves.toEqual({ ok: true });
    await expect(
      emitWithAck(ownerSocket, "project.join", {
        projectId: project._id.toString(),
      })
    ).resolves.toEqual({ ok: true });
    await expect(
      emitWithAck(ownerSocket, "task.join", { taskId: task._id.toString() })
    ).resolves.toEqual({ ok: true });
    await expect(
      emitWithAck(outsiderSocket, "project.join", {
        projectId: project._id.toString(),
      })
    ).resolves.toMatchObject({ ok: false });
    await expect(
      emitWithAck(outsiderSocket, "task.join", { taskId: task._id.toString() })
    ).resolves.toMatchObject({ ok: false });

    expect(outsider.workspaceId).not.toBe(owner.workspaceId);
  });

  it("broadcasts task domain events only inside the workspace", async () => {
    const owner = await registerUser("rt-task-owner@example.com", "Task Owner");
    const member = await registerUser("rt-task-member@example.com", "Task Member");
    const outsider = await registerUser(
      "rt-task-outsider@example.com",
      "Task Outsider"
    );
    await addMemberToWorkspace(member.userId, owner.workspaceId);
    const { project } = await createProjectService(
      owner.userId,
      owner.workspaceId,
      { name: "Realtime Tasks" }
    );

    const memberSocket = await connectSocket(
      await loginCookieFor("rt-task-member@example.com")
    );
    const outsiderSocket = await connectSocket(
      await loginCookieFor("rt-task-outsider@example.com")
    );
    const taskCreated = waitForEvent<{
      taskId: string;
      workspaceId: string;
      projectId: string;
    }>(memberSocket, "task.created");

    await createTaskService(
      owner.workspaceId,
      project._id.toString(),
      owner.userId,
      {
        title: "Live Task",
        priority: TaskPriorityEnum.HIGH,
        status: TaskStatusEnum.TODO,
      },
      contextFor(owner.userId, owner.workspaceId, "live-task")
    );

    const payload = await taskCreated;
    expect(payload.workspaceId).toBe(owner.workspaceId);
    expect(payload.projectId).toBe(project._id.toString());
    await expectNoEvent(outsiderSocket, "task.created");
    expect(outsider.workspaceId).not.toBe(owner.workspaceId);
  });

  it("delivers notification.created only to the recipient user room", async () => {
    const owner = await registerUser("rt-notify-owner@example.com", "Notify Owner");
    const member = await registerUser(
      "rt-notify-member@example.com",
      "Notify Member"
    );
    const outsider = await registerUser(
      "rt-notify-outsider@example.com",
      "Notify Outsider"
    );
    await addMemberToWorkspace(member.userId, owner.workspaceId);

    const memberSocket = await connectSocket(
      await loginCookieFor("rt-notify-member@example.com")
    );
    const outsiderSocket = await connectSocket(
      await loginCookieFor("rt-notify-outsider@example.com")
    );
    const notificationCreated = waitForEvent<{
      notificationId: string;
      recipientId: string;
      category: string;
    }>(memberSocket, "notification.created");

    await emitDomainEvent({
      type: DomainEventTypeEnum.NOTIFICATION_CREATED,
      context: contextFor(owner.userId, owner.workspaceId, "notify"),
      entityType: DomainEntityTypeEnum.NOTIFICATION,
      entityId: owner.workspaceId,
      target: {
        type: DomainEntityTypeEnum.TASK,
        id: owner.workspaceId,
      },
      metadata: {
        recipientId: member.userId,
        category: NotificationCategoryEnum.TASK,
      },
      occurredAt: new Date(),
    });

    await expect(notificationCreated).resolves.toMatchObject({
      recipientId: member.userId,
      category: NotificationCategoryEnum.TASK,
    });
    await expectNoEvent(outsiderSocket, "notification.created");
    expect(outsider.workspaceId).not.toBe(owner.workspaceId);
  });

  it("tracks presence across multiple tabs and emits offline after the final disconnect", async () => {
    const owner = await registerUser(
      "rt-presence-owner@example.com",
      "Presence Owner"
    );
    const member = await registerUser(
      "rt-presence-member@example.com",
      "Presence Member"
    );
    await addMemberToWorkspace(member.userId, owner.workspaceId);

    const memberSocket = await connectSocket(
      await loginCookieFor("rt-presence-member@example.com")
    );
    const ownerCookie = await loginCookieFor("rt-presence-owner@example.com");

    const ownerOnline = waitForPresence(memberSocket, "user.online", owner.userId);
    const ownerSocketOne = await connectSocket(ownerCookie);
    await expect(ownerOnline).resolves.toMatchObject({
      userId: owner.userId,
      workspaceId: owner.workspaceId,
    });

    const ownerSocketTwo = await connectSocket(ownerCookie);
    await expectNoPresence(memberSocket, "user.online", owner.userId);

    ownerSocketOne.disconnect();
    await expectNoPresence(memberSocket, "user.offline", owner.userId);

    const ownerOffline = waitForPresence(
      memberSocket,
      "user.offline",
      owner.userId
    );
    ownerSocketTwo.disconnect();
    await expect(ownerOffline).resolves.toMatchObject({
      userId: owner.userId,
      workspaceId: owner.workspaceId,
    });
  });
});
