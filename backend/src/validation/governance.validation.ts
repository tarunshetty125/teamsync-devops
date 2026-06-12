import { z } from "zod";
import { Permissions } from "../enums/role.enum";
import {
  ExportDatasetEnum,
  ExportFormatEnum,
} from "../models/export-job.model";
import { objectIdSchema, paginationSchema } from "./common.validation";

export const roleIdSchema = objectIdSchema("Role ID");
export const memberIdSchema = objectIdSchema("Member ID");
export const exportIdSchema = objectIdSchema("Export ID");
export const sessionIdParamSchema = z.string().trim().min(16).max(256);

export const auditQuerySchema = paginationSchema.extend({
  userId: objectIdSchema("User ID").optional(),
  entityType: z.string().trim().max(80).optional(),
  action: z.string().trim().max(80).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  q: z.string().trim().max(120).optional(),
});

export const rolePayloadSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  permissions: z.array(z.nativeEnum(Permissions)).min(1).max(80),
});

export const roleAssignmentSchema = z.object({
  roleId: roleIdSchema,
});

const retentionSchema = z.union([
  z.literal(90),
  z.literal(180),
  z.literal(365),
  z.null(),
]);

export const policyPayloadSchema = z.object({
  comments: z
    .object({
      allowEdit: z.boolean(),
      allowDelete: z.boolean(),
    })
    .optional(),
  files: z
    .object({
      maxUploadBytes: z.coerce.number().int().min(1).max(50 * 1024 * 1024),
      allowedMimeTypes: z.array(z.string().trim().min(1).max(120)).max(50),
    })
    .optional(),
  members: z
    .object({
      allowSelfInvite: z.boolean(),
      allowGuestInvite: z.boolean(),
    })
    .optional(),
  retention: z
    .object({
      notificationsDays: retentionSchema,
      activityDays: retentionSchema,
      auditDays: retentionSchema,
      commentsDays: retentionSchema,
      filesDays: retentionSchema,
    })
    .optional(),
});

export const exportPayloadSchema = z.object({
  datasets: z
    .array(z.nativeEnum(ExportDatasetEnum))
    .min(1)
    .max(Object.keys(ExportDatasetEnum).length),
  format: z.nativeEnum(ExportFormatEnum),
});

export const exportListQuerySchema = paginationSchema;

export const securityQuerySchema = paginationSchema;

export const bulkMemberActionSchema = z.object({
  memberIds: z.array(memberIdSchema).min(1).max(50),
});

export const bulkRoleChangeSchema = bulkMemberActionSchema.extend({
  roleId: roleIdSchema,
});
