import { z } from "zod";
import { objectIdSchema, paginationSchema } from "./common.validation";

const emojiSchema = z.string().trim().max(32).optional();
const nameSchema = z.string().trim().min(1).max(255);
const descriptionSchema = z.string().trim().optional();

export const projectIdSchema = objectIdSchema("Project ID");
export const projectPaginationSchema = paginationSchema;

export const createProjectSchema = z.object({
  emoji: emojiSchema,
  name: nameSchema,
  description: descriptionSchema,
});

export const updateProjectSchema = z.object({
  emoji: emojiSchema,
  name: nameSchema,
  description: descriptionSchema,
});
