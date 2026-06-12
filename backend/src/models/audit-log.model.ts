import mongoose, { Document, Schema } from "mongoose";
import {
  AuditActionEnum,
  AuditActionType,
  DomainEntityType,
  DomainEntityTypeEnum,
} from "../enums/domain.enum";

export interface AuditLogDocument extends Document {
  workspace: mongoose.Types.ObjectId;
  actor: mongoose.Types.ObjectId;
  action: AuditActionType;
  entityType: DomainEntityType;
  entityId: mongoose.Types.ObjectId;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  requestId: string;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: Object.values(AuditActionEnum),
      required: true,
    },
    entityType: {
      type: String,
      enum: Object.values(DomainEntityTypeEnum),
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    before: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    after: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    ipAddress: {
      type: String,
      required: true,
      trim: true,
    },
    userAgent: {
      type: String,
      required: true,
      trim: true,
    },
    requestId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ workspace: 1, createdAt: -1 });
auditLogSchema.index({ workspace: 1, actor: 1, createdAt: -1 });
auditLogSchema.index({ workspace: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ workspace: 1, entityType: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ requestId: 1 });

const AuditLogModel = mongoose.model<AuditLogDocument>(
  "AuditLog",
  auditLogSchema
);

export default AuditLogModel;
