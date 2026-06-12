import mongoose from "mongoose";
import { z } from "zod";

export const objectIdSchema = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => mongoose.Types.ObjectId.isValid(value), {
      message: `${label} must be a valid ObjectId`,
    });

export const paginationSchema = z.object({
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  pageNumber: z.coerce.number().int().min(1).default(1),
});

export const commaSeparatedEnumArray = <T extends [string, ...string[]]>(
  values: T
) =>
  z.preprocess((value) => {
    if (typeof value !== "string" || value.trim() === "") {
      return undefined;
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }, z.array(z.enum(values)).max(20).optional());
