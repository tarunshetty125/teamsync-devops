import crypto from "crypto";
import { Request } from "express";
import { config } from "../config/app.config";
import LoginEventModel from "../models/login-event.model";
import MemberModel from "../models/member.model";
import SessionRecordModel from "../models/session-record.model";
import { NotFoundException } from "../utils/appError";
import { assertOwnerOrAdmin } from "./governance-access.service";

type RegistrySession = CookieSessionInterfaces.CookieSessionObject & {
  sessionId?: string;
};

const hashSessionId = (sessionId: string) =>
  crypto.createHash("sha256").update(sessionId).digest("hex");

const getIpAddress = (req: Request) =>
  req.ip || req.socket.remoteAddress || "";

const getUserAgent = (req: Request) => req.get("user-agent") || "";

const getSession = (req: Request): RegistrySession | null | undefined =>
  req.session as RegistrySession | null | undefined;

export const createSessionRecord = async (
  req: Request,
  userId: string,
  provider: string
) => {
  const session = getSession(req);
  if (!session) return null;

  const sessionId = crypto.randomBytes(32).toString("hex");
  session.sessionId = sessionId;
  const now = new Date();

  await Promise.all([
    SessionRecordModel.create({
      sessionIdHash: hashSessionId(sessionId),
      user: userId,
      lastActiveAt: now,
      expiresAt: new Date(now.getTime() + config.SESSION_COOKIE_MAX_AGE),
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    }),
    LoginEventModel.create({
      user: userId,
      provider,
      success: true,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    }),
  ]);

  return sessionId;
};

export const ensureSessionRecord = async (req: Request) => {
  const session = getSession(req);
  const userId = req.user?._id?.toString();

  if (!session || !userId) return { valid: true };

  if (!session.sessionId) {
    await createSessionRecord(req, userId, "SESSION");
    return { valid: true };
  }

  const record = await SessionRecordModel.findOne({
    sessionIdHash: hashSessionId(session.sessionId),
    user: userId,
  });

  if (!record || record.revokedAt || record.expiresAt <= new Date()) {
    return { valid: false };
  }

  record.lastActiveAt = new Date();
  record.ipAddress = getIpAddress(req);
  record.userAgent = getUserAgent(req);
  await record.save();

  return { valid: true };
};

const serializeSession = (record: Record<string, any>) => ({
  sessionId: record._id.toString(),
  userId: record.user.toString(),
  createdAt: record.createdAt,
  lastActiveAt: record.lastActiveAt,
  expiresAt: record.expiresAt,
  revokedAt: record.revokedAt,
  ipAddress: record.ipAddress,
  userAgent: record.userAgent,
});

const serializeLogin = (record: Record<string, any>) => ({
  _id: record._id.toString(),
  userId: record.user.toString(),
  provider: record.provider,
  success: record.success,
  ipAddress: record.ipAddress,
  userAgent: record.userAgent,
  createdAt: record.createdAt,
});

export const listWorkspaceSessionsService = async (
  workspaceId: string,
  actorUserId: string,
  pagination: { pageNumber: number; pageSize: number }
) => {
  await assertOwnerOrAdmin(workspaceId, actorUserId);

  const userIds = await MemberModel.find({
    workspaceId,
    status: { $ne: "DEACTIVATED" },
  }).distinct("userId");
  const skip = (pagination.pageNumber - 1) * pagination.pageSize;
  const query = {
    user: { $in: userIds },
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  };
  const [sessions, totalCount] = await Promise.all([
    SessionRecordModel.find(query)
      .sort({ lastActiveAt: -1 })
      .skip(skip)
      .limit(pagination.pageSize)
      .lean(),
    SessionRecordModel.countDocuments(query),
  ]);

  return {
    sessions: sessions.map(serializeSession),
    pagination: {
      totalCount,
      pageSize: pagination.pageSize,
      pageNumber: pagination.pageNumber,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
      skip,
      limit: pagination.pageSize,
    },
  };
};

export const listWorkspaceLoginsService = async (
  workspaceId: string,
  actorUserId: string,
  pagination: { pageNumber: number; pageSize: number }
) => {
  await assertOwnerOrAdmin(workspaceId, actorUserId);

  const userIds = await MemberModel.find({ workspaceId }).distinct("userId");
  const skip = (pagination.pageNumber - 1) * pagination.pageSize;
  const query = { user: { $in: userIds } };
  const [logins, totalCount] = await Promise.all([
    LoginEventModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pagination.pageSize)
      .lean(),
    LoginEventModel.countDocuments(query),
  ]);

  return {
    logins: logins.map(serializeLogin),
    pagination: {
      totalCount,
      pageSize: pagination.pageSize,
      pageNumber: pagination.pageNumber,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
      skip,
      limit: pagination.pageSize,
    },
  };
};

export const revokeWorkspaceSessionService = async (
  workspaceId: string,
  actorUserId: string,
  sessionRecordId: string
) => {
  await assertOwnerOrAdmin(workspaceId, actorUserId);

  const userIds = await MemberModel.find({ workspaceId }).distinct("userId");
  const sessionRecord = await SessionRecordModel.findOne({
    _id: sessionRecordId,
    user: { $in: userIds },
    revokedAt: null,
  });

  if (!sessionRecord) {
    throw new NotFoundException("Session not found");
  }

  sessionRecord.revokedAt = new Date();
  sessionRecord.revokedBy = actorUserId as any;
  await sessionRecord.save();
};

export const revokeWorkspaceSessionsService = async (
  workspaceId: string,
  actorUserId: string
) => {
  await assertOwnerOrAdmin(workspaceId, actorUserId);

  const userIds = await MemberModel.find({ workspaceId }).distinct("userId");
  await SessionRecordModel.updateMany(
    {
      user: { $in: userIds },
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
        revokedBy: actorUserId,
      },
    }
  );
};

export const revokeCurrentSessionRecord = async (
  req: Request,
  revokedBy: string
) => {
  const session = getSession(req);
  if (!session?.sessionId) return;

  await SessionRecordModel.updateOne(
    {
      sessionIdHash: hashSessionId(session.sessionId),
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
        revokedBy,
      },
    }
  );
};
