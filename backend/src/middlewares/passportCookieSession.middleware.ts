import { RequestHandler } from "express";

type PassportCookieSession = {
  csrfToken?: string;
  regenerate?: (callback: (error?: unknown) => void) => void;
  save?: (callback: (error?: unknown) => void) => void;
};

export const passportCookieSessionCompat: RequestHandler = (req, _res, next) => {
  if (!req.session) {
    next();
    return;
  }

  const session = req.session as PassportCookieSession;

  Object.defineProperties(session, {
    regenerate: {
      configurable: true,
      enumerable: false,
      value: (callback: (error?: unknown) => void) => {
        const csrfToken = session.csrfToken;
        const mutableSession = session as Record<string, unknown>;

        Object.keys(mutableSession).forEach((key) => {
          delete mutableSession[key];
        });

        if (csrfToken) {
          session.csrfToken = csrfToken;
        }

        callback();
      },
    },
    save: {
      configurable: true,
      enumerable: false,
      value: (callback: (error?: unknown) => void) => callback(),
    },
  });

  next();
};
