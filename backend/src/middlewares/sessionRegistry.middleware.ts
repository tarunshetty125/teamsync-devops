import { NextFunction, Request, Response } from "express";
import { ensureSessionRecord } from "../services/session-registry.service";
import { UnauthorizedException } from "../utils/appError";

export const sessionRegistryMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const result = await ensureSessionRecord(req);

    if (!result.valid) {
      req.logout(() => undefined);
      req.session = null;
      throw new UnauthorizedException("Session has been revoked");
    }

    next();
  } catch (error) {
    next(error);
  }
};
