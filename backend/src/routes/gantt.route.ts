import { Router } from "express";
import { getGanttController } from "../controllers/gantt.controller";

const ganttRoutes = Router();

ganttRoutes.get("/workspace/:workspaceId", getGanttController);

export default ganttRoutes;
