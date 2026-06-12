import { Router } from "express";
import { listAuditLogsController } from "../controllers/audit.controller";

const auditRoutes = Router();

auditRoutes.get("/workspace/:workspaceId", listAuditLogsController);

export default auditRoutes;
