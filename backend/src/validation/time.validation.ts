import { z } from "zod";
import { objectIdSchema, paginationSchema } from "./common.validation";

export const productivityRangeEnum = {
  SEVEN_DAYS: "7d",
  FOURTEEN_DAYS: "14d",
  THIRTY_DAYS: "30d",
  NINETY_DAYS: "90d",
} as const;

export type ProductivityRange =
  (typeof productivityRangeEnum)[keyof typeof productivityRangeEnum];

export const productivityRangeDays: Record<ProductivityRange, number> = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
};

const optionalObjectId = (label: string) =>
  objectIdSchema(label).optional().nullable();

const optionalDateSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
    message: "Date must be a valid date string",
  });

const requiredDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Date must be a valid date string",
  });

const noteSchema = z.string().trim().max(1000).optional().nullable();

const dateWindowBaseSchema = z.object({
    startDate: optionalDateSchema,
    endDate: optionalDateSchema,
  });

const withDateWindowValidation = <T extends z.ZodTypeAny>(schema: T) =>
  schema
  .refine((query) => Boolean(query.startDate) === Boolean(query.endDate), {
    message: "Both startDate and endDate must be provided together",
    path: ["endDate"],
  })
  .refine(
    (query) => {
      const dateQuery = query as { startDate?: string; endDate?: string };
      if (!dateQuery.startDate || !dateQuery.endDate) return true;
      return new Date(dateQuery.startDate) <= new Date(dateQuery.endDate);
    },
    {
      message: "startDate must be before or equal to endDate",
      path: ["endDate"],
    }
  )
  .refine(
    (query) => {
      const dateQuery = query as { startDate?: string; endDate?: string };
      if (!dateQuery.startDate || !dateQuery.endDate) return true;
      const diffMs =
        new Date(dateQuery.endDate).getTime() -
        new Date(dateQuery.startDate).getTime();
      return diffMs <= 90 * 24 * 60 * 60 * 1000;
    },
    {
      message: "Date range cannot exceed 90 days",
      path: ["endDate"],
    }
  );

export const startTimerSchema = z.object({
  taskId: optionalObjectId("Task ID"),
  projectId: optionalObjectId("Project ID"),
  note: noteSchema,
});

export const createTimeEntrySchema = z
  .object({
    taskId: optionalObjectId("Task ID"),
    projectId: optionalObjectId("Project ID"),
    startedAt: requiredDateSchema,
    endedAt: requiredDateSchema,
    note: noteSchema,
  })
  .refine((body) => new Date(body.startedAt) < new Date(body.endedAt), {
    message: "endedAt must be after startedAt",
    path: ["endedAt"],
  });

export const updateTimeEntrySchema = z
  .object({
    taskId: optionalObjectId("Task ID"),
    projectId: optionalObjectId("Project ID"),
    startedAt: optionalDateSchema,
    endedAt: optionalDateSchema,
    note: noteSchema,
  })
  .refine((body) => Boolean(body.startedAt) === Boolean(body.endedAt), {
    message: "startedAt and endedAt must be updated together",
    path: ["endedAt"],
  })
  .refine(
    (body) => {
      if (!body.startedAt || !body.endedAt) return true;
      return new Date(body.startedAt) < new Date(body.endedAt);
    },
    {
      message: "endedAt must be after startedAt",
      path: ["endedAt"],
    }
  );

export const listTimeEntriesQuerySchema = withDateWindowValidation(
  dateWindowBaseSchema.merge(
    paginationSchema.extend({
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    })
  ).extend({
    userId: objectIdSchema("User ID").optional(),
    projectId: objectIdSchema("Project ID").optional(),
    taskId: objectIdSchema("Task ID").optional(),
  })
);

export const timesheetQuerySchema = withDateWindowValidation(
  dateWindowBaseSchema.extend({
    userId: objectIdSchema("User ID").optional(),
  })
);

export const productivityRangeQuerySchema = z.object({
  range: z
    .enum(
      Object.values(productivityRangeEnum) as [
        ProductivityRange,
        ...ProductivityRange[],
      ]
    )
    .default(productivityRangeEnum.SEVEN_DAYS),
});

export const updateCapacitySchema = z.object({
  capacityHoursPerWeek: z.coerce.number().min(0).max(168),
});

export const timeEntryIdSchema = objectIdSchema("Time entry ID");
export const memberIdSchema = objectIdSchema("Member ID");
