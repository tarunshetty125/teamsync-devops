import mongoose, { ClientSession } from "mongoose";
import {
  AuditActionType,
  DomainEntityType,
} from "../enums/domain.enum";
import AuditLogModel from "../models/audit-log.model";
import { RequestContext } from "../types/request-context";

type RecordAuditLogInput = {
  action: AuditActionType;
  entityType: DomainEntityType;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export const recordAuditLog = async (
  context: RequestContext,
  input: RecordAuditLogInput,
  session?: ClientSession
) => {
  const auditLogInput = {
    workspace: new mongoose.Types.ObjectId(context.workspaceId),
    actor: new mongoose.Types.ObjectId(context.userId),
    action: input.action,
    entityType: input.entityType,
    entityId: new mongoose.Types.ObjectId(input.entityId),
    before: input.before,
    after: input.after,
    metadata: input.metadata,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    requestId: context.requestId,
  };

  const auditLog = session
    ? (await AuditLogModel.create([auditLogInput], { session }))[0]
    : await AuditLogModel.create(auditLogInput);

  return { auditLog };
};
