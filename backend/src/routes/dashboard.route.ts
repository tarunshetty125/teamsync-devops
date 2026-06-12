import { Router } from "express";
import {
  getExecutiveDashboardController,
  getPersonalDashboardController,
  getTeamDashboardController,
} from "../controllers/dashboard.controller";

const dashboardRoutes = Router();

dashboardRoutes.get(
  "/workspace/:workspaceId/personal",
  getPersonalDashboardController
);
dashboardRoutes.get("/workspace/:workspaceId/team", getTeamDashboardController);
dashboardRoutes.get(
  "/workspace/:workspaceId/executive",
  getExecutiveDashboardController
);

export default dashboardRoutes;
