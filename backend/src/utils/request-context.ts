import { Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { RequestContext } from "../types/request-context";
import { UnauthorizedException } from "./appError";

export const buildRequestContext = (
  req: Request,
  workspaceId: string
): RequestContext => {
  const userId = req.user?._id?.toString();

  if (!userId) {
    throw new UnauthorizedException("Authenticated user context is required");
  }

  return {
    requestId:
      req.get("x-request-id") || req.get("x-correlation-id") || uuidv4(),
    userId,
    workspaceId,
    ipAddress: req.ip || req.socket.remoteAddress || "",
    userAgent: req.get("user-agent") || "",
  };
};
