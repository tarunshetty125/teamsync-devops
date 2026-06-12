import { Router } from "express";
import { getTimelineController } from "../controllers/timeline.controller";

const timelineRoutes = Router();

timelineRoutes.get("/workspace/:workspaceId", getTimelineController);

export default timelineRoutes;
