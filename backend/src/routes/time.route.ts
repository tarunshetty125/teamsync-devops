import { Router } from "express";
import {
  createTimeEntryController,
  deleteTimeEntryController,
  getActiveTimerController,
  getCapacityController,
  getTimesheetController,
  getWorkloadController,
  listTimeEntriesController,
  startTimerController,
  stopTimerController,
  updateCapacityController,
  updateTimeEntryController,
} from "../controllers/time.controller";
import { writeApiRateLimiter } from "../middlewares/rateLimit.middleware";

const timeRoutes = Router();

timeRoutes.get("/workspace/:workspaceId/active", getActiveTimerController);
timeRoutes.post(
  "/workspace/:workspaceId/timer/start",
  writeApiRateLimiter,
  startTimerController
);
timeRoutes.post(
  "/workspace/:workspaceId/timer/stop",
  writeApiRateLimiter,
  stopTimerController
);
timeRoutes.post(
  "/workspace/:workspaceId/entries",
  writeApiRateLimiter,
  createTimeEntryController
);
timeRoutes.get("/workspace/:workspaceId/entries", listTimeEntriesController);
timeRoutes.patch(
  "/workspace/:workspaceId/entries/:entryId",
  writeApiRateLimiter,
  updateTimeEntryController
);
timeRoutes.delete(
  "/workspace/:workspaceId/entries/:entryId",
  writeApiRateLimiter,
  deleteTimeEntryController
);
timeRoutes.get("/workspace/:workspaceId/timesheet", getTimesheetController);
timeRoutes.get("/workspace/:workspaceId/workload", getWorkloadController);
timeRoutes.get("/workspace/:workspaceId/capacity", getCapacityController);
timeRoutes.patch(
  "/workspace/:workspaceId/capacity/:memberId",
  writeApiRateLimiter,
  updateCapacityController
);

export default timeRoutes;
