import { RequestHandler } from "express";
import { config } from "../config/app.config";
import { recordHttpMetric } from "../services/metrics.service";

const shouldSkipLog = (path: string) =>
  path === "/" ||
  path === "/health" ||
  path === "/health/live" ||
  path === "/health/ready" ||
  path === "/metrics";

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    recordHttpMetric({
      method: req.method,
      path: req.route?.path?.toString() || req.path,
      statusCode: res.statusCode,
      durationMs,
    });

    if (config.NODE_ENV === "test" || shouldSkipLog(req.path)) return;

    const logPayload = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      requestId: req.get("x-request-id") || req.get("x-correlation-id"),
      ip: req.ip,
    };

    if (res.statusCode >= 500 || (!config.IS_PRODUCTION && res.statusCode >= 400)) {
      console.warn("http_request", logPayload);
      return;
    }

    if (!config.IS_PRODUCTION) {
      console.info("http_request", logPayload);
    }
  });

  next();
};
