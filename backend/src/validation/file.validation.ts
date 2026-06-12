import { z } from "zod";
import { DomainEntityTypeEnum } from "../enums/domain.enum";
import { objectIdSchema, paginationSchema } from "./common.validation";

export const fileIdSchema = objectIdSchema("File ID");
export const fileTargetIdSchema = objectIdSchema("File target ID");

export const fileTargetTypeSchema = z.enum([
  DomainEntityTypeEnum.TASK,
  DomainEntityTypeEnum.PROJECT,
]);

export const fileListQuerySchema = paginationSchema.extend({
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
