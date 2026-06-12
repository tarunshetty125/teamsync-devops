import "dotenv/config";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import passport from "passport";
import { config } from "./config/app.config";
import { HTTPSTATUS } from "./config/http.config";
import { corsOptions } from "./middlewares/cors.middleware";
import { csrfProtection } from "./middlewares/csrf.middleware";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import { generalApiRateLimiter } from "./middlewares/rateLimit.middleware";
import isAuthenticated from "./middlewares/isAuthenticated.middleware";
import { passportCookieSessionCompat } from "./middlewares/passportCookieSession.middleware";
import { requestLogger } from "./middlewares/requestLogger.middleware";
import activityRoutes from "./routes/activity.route";
import auditRoutes from "./routes/audit.route";
import authRoutes from "./routes/auth.route";
import commentRoutes from "./routes/comment.route";
import dashboardRoutes from "./routes/dashboard.route";
import fileRoutes from "./routes/file.route";
import ganttRoutes from "./routes/gantt.route";
import labelRoutes from "./routes/label.route";
import memberRoutes from "./routes/member.route";
import milestoneRoutes from "./routes/milestone.route";
import notificationRoutes from "./routes/notification.route";
import projectRoutes from "./routes/project.route";
import policyRoutes from "./routes/policy.route";
import roleRoutes from "./routes/role.route";
import exportRoutes from "./routes/export.route";
import securityRoutes from "./routes/security.route";
import searchRoutes from "./routes/search.route";
import taskRoutes from "./routes/task.route";
import timeRoutes from "./routes/time.route";
import timelineRoutes from "./routes/timeline.route";
import userRoutes from "./routes/user.route";
import workspaceRoutes from "./routes/workspace.route";
import { registerNotificationEventHandlers } from "./services/notification-event-handlers.service";
import { sessionMiddleware } from "./middlewares/session.middleware";
import { sessionRegistryMiddleware } from "./middlewares/sessionRegistry.middleware";
import { getPrometheusMetrics } from "./services/metrics.service";

import "./config/passport.config";

const createApp = () => {
  const app = express();
  const basePath = config.BASE_PATH;
  registerNotificationEventHandlers();

  app.set("trust proxy", config.IS_PRODUCTION ? 1 : false);

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    })
  );
  app.use(cors(corsOptions));
  app.use(requestLogger);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  app.use(sessionMiddleware);

  app.use(passportCookieSessionCompat);
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(sessionRegistryMiddleware);
  app.use(csrfProtection);

  app.get("/", (_req: Request, res: Response) => {
    res.status(HTTPSTATUS.OK).json({ status: "ok" });
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.status(HTTPSTATUS.OK).json({ status: "ok", uptime: process.uptime() });
  });

  app.get("/health/live", (_req: Request, res: Response) => {
    res.status(HTTPSTATUS.OK).json({ status: "ok", uptime: process.uptime() });
  });

  app.get("/health/ready", (_req: Request, res: Response) => {
    const databaseReady = mongoose.connection.readyState === 1;
    res.status(databaseReady ? HTTPSTATUS.OK : HTTPSTATUS.SERVICE_UNAVAILABLE).json({
      status: databaseReady ? "ready" : "not_ready",
      database: databaseReady ? "connected" : "disconnected",
      uptime: process.uptime(),
    });
  });

  app.get("/metrics", (_req: Request, res: Response) => {
    res
      .status(HTTPSTATUS.OK)
      .type("text/plain; version=0.0.4")
      .send(getPrometheusMetrics());
  });

  app.use((req: Request, res: Response, next: NextFunction): void => {
    if (!config.IS_PRODUCTION || req.secure) {
      next();
      return;
    }

    const forwardedProto = req.get("x-forwarded-proto");
    if (forwardedProto === "https") {
      next();
      return;
    }

    res.status(HTTPSTATUS.BAD_REQUEST).json({
      message: "HTTPS is required",
    });
  });

  app.use(basePath, generalApiRateLimiter);
  app.use(`${basePath}/auth`, authRoutes);
  app.use(`${basePath}/user`, isAuthenticated, userRoutes);
  app.use(`${basePath}/workspace`, isAuthenticated, workspaceRoutes);
  app.use(`${basePath}/member`, isAuthenticated, memberRoutes);
  app.use(`${basePath}/project`, isAuthenticated, projectRoutes);
  app.use(`${basePath}/task`, isAuthenticated, taskRoutes);
  app.use(`${basePath}/time`, isAuthenticated, timeRoutes);
  app.use(`${basePath}/comment`, isAuthenticated, commentRoutes);
  app.use(`${basePath}/dashboard`, isAuthenticated, dashboardRoutes);
  app.use(`${basePath}/activity`, isAuthenticated, activityRoutes);
  app.use(`${basePath}/audit`, isAuthenticated, auditRoutes);
  app.use(`${basePath}/file`, isAuthenticated, fileRoutes);
  app.use(`${basePath}/export`, isAuthenticated, exportRoutes);
  app.use(`${basePath}/gantt`, isAuthenticated, ganttRoutes);
  app.use(`${basePath}/label`, isAuthenticated, labelRoutes);
  app.use(`${basePath}/milestone`, isAuthenticated, milestoneRoutes);
  app.use(`${basePath}/notification`, isAuthenticated, notificationRoutes);
  app.use(`${basePath}/policy`, isAuthenticated, policyRoutes);
  app.use(`${basePath}/role`, isAuthenticated, roleRoutes);
  app.use(`${basePath}/security`, isAuthenticated, securityRoutes);
  app.use(`${basePath}/search`, isAuthenticated, searchRoutes);
  app.use(`${basePath}/timeline`, isAuthenticated, timelineRoutes);

  app.use(errorHandler);

  return app;
};

const app = createApp();

export default app;
