import { z } from "zod";
import {
  CommentTargetType,
  CommentTargetTypeEnum,
} from "../enums/domain.enum";
import { objectIdSchema, paginationSchema } from "./common.validation";

export const activityFeedQuerySchema = paginationSchema
  .extend({
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    targetType: z
      .enum(
        Object.values(CommentTargetTypeEnum) as [
          CommentTargetType,
          ...CommentTargetType[]
        ]
      )
      .optional(),
    targetId: objectIdSchema("Activity target ID").optional(),
  })
  .refine((query) => Boolean(query.targetType) === Boolean(query.targetId), {
    message: "targetType and targetId must be provided together",
  });
