import session from "cookie-session";
import { config } from "../config/app.config";

export const sessionMiddleware = session({
  name: config.SESSION_COOKIE_NAME,
  keys: [config.SESSION_SECRET],
  maxAge: config.SESSION_COOKIE_MAX_AGE,
  secure: config.IS_PRODUCTION,
  httpOnly: true,
  sameSite: "lax",
});
