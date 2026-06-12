import { ServerResponse } from "http";
import { Request, RequestHandler, Response } from "express";
import passport from "passport";
import MemberModel from "../models/member.model";
import { passportCookieSessionCompat } from "../middlewares/passportCookieSession.middleware";
import { sessionMiddleware } from "../middlewares/session.middleware";
import { RoleType } from "../enums/role.enum";
import { RealtimeSocket } from "./realtime.types";

type LeanMembership = {
  workspaceId: { toString: () => string };
  role?: {
    name?: RoleType;
  };
};

const runMiddleware = (
  middleware: RequestHandler,
  req: Request,
  res: Response
) =>
  new Promise<void>((resolve, reject) => {
    middleware(req, res, (error?: unknown) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

export const authenticateSocket = async (
  socket: RealtimeSocket,
  next: (error?: Error) => void
) => {
  const req = socket.request as Request;
  const res = new ServerResponse(socket.request) as unknown as Response;

  try {
    await runMiddleware(sessionMiddleware, req, res);
    await runMiddleware(passportCookieSessionCompat, req, res);
    await runMiddleware(passport.initialize(), req, res);
    await runMiddleware(passport.session(), req, res);

    const userId = req.user?._id?.toString();

    if (!userId) {
      next(new Error("Unauthorized"));
      return;
    }

    const memberships = (await MemberModel.find({ userId })
      .populate("role", "name")
      .lean()) as unknown as LeanMembership[];

    if (memberships.length === 0) {
      next(new Error("No workspace memberships found"));
      return;
    }

    const rolesByWorkspaceId: Record<string, RoleType> = {};

    for (const membership of memberships) {
      const workspaceId = membership.workspaceId.toString();
      const roleName = membership.role?.name;

      if (roleName) {
        rolesByWorkspaceId[workspaceId] = roleName;
      }
    }

    socket.data.identity = {
      userId,
      workspaceIds: Object.keys(rolesByWorkspaceId),
      rolesByWorkspaceId,
    };

    next();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Socket authentication failed";
    next(new Error(message));
  }
};
