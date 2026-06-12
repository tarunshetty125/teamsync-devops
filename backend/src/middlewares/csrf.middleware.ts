import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { config } from "../config/app.config";
import { ForbiddenException } from "../utils/appError";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const csrfExemptPaths = new Set([
  `${config.BASE_PATH}/auth/login`,
  `${config.BASE_PATH}/auth/register`,
  `${config.BASE_PATH}/auth/google`,
  `${config.BASE_PATH}/auth/google/callback`,
]);

type SessionWithCsrf = CookieSessionInterfaces.CookieSessionObject & {
  csrfToken?: string;
};

const createToken = () => crypto.randomBytes(32).toString("hex");

const getSession = (req: Request): SessionWithCsrf | null | undefined =>
  req.session as SessionWithCsrf | null | undefined;

export const csrfProtection = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = getSession(req);

  if (!session) {
    next();
    return;
  }

  if (!session.csrfToken) {
    session.csrfToken = createToken();
  }

  res.cookie(config.CSRF_COOKIE_NAME, session.csrfToken, {
    httpOnly: false,
    maxAge: config.SESSION_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: config.IS_PRODUCTION,
  });

  if (SAFE_METHODS.has(req.method) || csrfExemptPaths.has(req.path)) {
    next();
    return;
  }

  const token = req.get("X-CSRF-Token");

  if (!token || token !== session.csrfToken) {
    throw new ForbiddenException("Invalid CSRF token");
  }

  next();
};
