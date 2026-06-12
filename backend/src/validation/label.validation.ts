import { z } from "zod";
import { objectIdSchema, paginationSchema } from "./common.validation";

export const labelIdSchema = objectIdSchema("Label ID");

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a hex color like #2563eb");

export const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: colorSchema,
  description: z.string().trim().max(255).optional().nullable(),
});

export const updateLabelSchema = createLabelSchema.partial().refine(
  (body) => Object.keys(body).length > 0,
  {
    message: "At least one label field must be provided",
  }
);

export const listLabelsQuerySchema = paginationSchema.extend({
  includeDeleted: z.coerce.boolean().default(false),
});
