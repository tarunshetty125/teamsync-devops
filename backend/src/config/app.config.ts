import path from "path";
import { getEnv } from "../utils/get-env";

const parseDurationMs = (value: string, fallbackMs: number): number => {
  const match = /^(\d+)(ms|s|m|h|d)?$/.exec(value.trim());

  if (!match) {
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = match[2] || "ms";
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
};

const appConfig = () => {
  const nodeEnv = getEnv("NODE_ENV", "development");

  return {
  NODE_ENV: nodeEnv,
  PORT: getEnv("PORT", "5000"),
  BASE_PATH: getEnv("BASE_PATH", "/v1"),
  MONGO_URI: getEnv(
    "MONGO_URI",
    nodeEnv === "production" ? "" : "mongodb://127.0.0.1:27017/teamsync"
  ),

  SESSION_SECRET: getEnv(
    "SESSION_SECRET",
    nodeEnv === "production" ? "" : "development-session-secret"
  ),
  SESSION_EXPIRES_IN: getEnv("SESSION_EXPIRES_IN", "1d"),
  SESSION_COOKIE_NAME: getEnv("SESSION_COOKIE_NAME", "teamsync.sid"),
  CSRF_COOKIE_NAME: getEnv("CSRF_COOKIE_NAME", "XSRF-TOKEN"),

  GOOGLE_CLIENT_ID: getEnv(
    "GOOGLE_CLIENT_ID",
    nodeEnv === "production" ? "" : "local-google-client-id"
  ),
  GOOGLE_CLIENT_SECRET: getEnv(
    "GOOGLE_CLIENT_SECRET",
    nodeEnv === "production" ? "" : "local-google-client-secret"
  ),
  GOOGLE_CALLBACK_URL: getEnv(
    "GOOGLE_CALLBACK_URL",
    nodeEnv === "production"
      ? ""
      : "http://localhost:5000/v1/auth/google/callback"
  ),

  FRONTEND_ORIGIN: getEnv("FRONTEND_ORIGIN", "http://localhost:5173"),
  FRONTEND_GOOGLE_CALLBACK_URL: getEnv(
    "FRONTEND_GOOGLE_CALLBACK_URL",
    nodeEnv === "production" ? "" : "http://localhost:5173/google/oauth/callback"
  ),

  LOCAL_FILE_STORAGE_DIR: getEnv(
    "LOCAL_FILE_STORAGE_DIR",
    path.resolve(process.cwd(), "uploads")
  ),
  MAX_ATTACHMENT_BYTES: Number(getEnv("MAX_ATTACHMENT_BYTES", "10485760")),
  MAX_AVATAR_BYTES: Number(getEnv("MAX_AVATAR_BYTES", "2097152")),
  };
};

const rawConfig = appConfig();

const isConfiguredSecret = (value: string): boolean => {
  const normalized = value.trim();

  return (
    Boolean(normalized) &&
    !/(^replace-with|^local-google|<|>|your-|example)/i.test(normalized)
  );
};

if (
  !Number.isInteger(rawConfig.MAX_ATTACHMENT_BYTES) ||
  rawConfig.MAX_ATTACHMENT_BYTES <= 0
) {
  throw new Error("MAX_ATTACHMENT_BYTES must be a positive integer");
}

if (!Number.isInteger(rawConfig.MAX_AVATAR_BYTES) || rawConfig.MAX_AVATAR_BYTES <= 0) {
  throw new Error("MAX_AVATAR_BYTES must be a positive integer");
}

if (
  rawConfig.NODE_ENV === "production" &&
  rawConfig.SESSION_SECRET.length < 32
) {
  throw new Error("SESSION_SECRET must be at least 32 characters in production");
}

const requireHttpsUrl = (value: string, name: string) => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production`);
  }
};

if (rawConfig.NODE_ENV === "production") {
  rawConfig.FRONTEND_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .forEach((origin) => requireHttpsUrl(origin, "FRONTEND_ORIGIN"));

  requireHttpsUrl(rawConfig.GOOGLE_CALLBACK_URL, "GOOGLE_CALLBACK_URL");
  requireHttpsUrl(
    rawConfig.FRONTEND_GOOGLE_CALLBACK_URL,
    "FRONTEND_GOOGLE_CALLBACK_URL"
  );
}

export const config = {
  ...rawConfig,
  IS_PRODUCTION: rawConfig.NODE_ENV === "production",
  GOOGLE_OAUTH_ENABLED:
    isConfiguredSecret(rawConfig.GOOGLE_CLIENT_ID) &&
    isConfiguredSecret(rawConfig.GOOGLE_CLIENT_SECRET),
  FRONTEND_ORIGINS: rawConfig.FRONTEND_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  SESSION_COOKIE_MAX_AGE: parseDurationMs(
    rawConfig.SESSION_EXPIRES_IN,
    24 * 60 * 60 * 1000
  ),
};
