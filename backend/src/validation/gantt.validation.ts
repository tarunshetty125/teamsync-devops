import { z } from "zod";
import { TaskStatusEnum } from "../enums/task.enum";
import {
  commaSeparatedEnumArray,
  objectIdSchema,
} from "./common.validation";
import {
  TimelineRange,
  timelineRangeEnum,
  timelineRangeToDays,
} from "./timeline.validation";

const commaSeparatedObjectIdArray = (label: string, max = 50) =>
  z.preprocess((value) => {
    if (typeof value !== "string" || value.trim() === "") {
      return undefined;
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }, z.array(objectIdSchema(label)).max(max).optional());

const optionalDateSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
    message: "Date must be a valid date string",
  });

export const ganttQuerySchema = z
  .object({
    range: z
      .enum(Object.values(timelineRangeEnum) as [TimelineRange, ...TimelineRange[]])
      .default(timelineRangeEnum.NINETY_DAYS),
    startDate: optionalDateSchema,
    endDate: optionalDateSchema,
    projectIds: commaSeparatedObjectIdArray("Project ID"),
    assigneeIds: commaSeparatedObjectIdArray("Assignee ID"),
    labelIds: commaSeparatedObjectIdArray("Label ID"),
    statuses: commaSeparatedEnumArray(
      Object.values(TaskStatusEnum) as [string, ...string[]]
    ),
  })
  .refine((query) => Boolean(query.startDate) === Boolean(query.endDate), {
    message: "Both startDate and endDate must be provided together",
    path: ["endDate"],
  })
  .refine(
    (query) => {
      if (!query.startDate || !query.endDate) return true;
      return new Date(query.startDate) <= new Date(query.endDate);
    },
    {
      message: "startDate must be before or equal to endDate",
      path: ["endDate"],
    }
  )
  .refine(
    (query) => {
      if (!query.startDate || !query.endDate) return true;
      const diffMs =
        new Date(query.endDate).getTime() - new Date(query.startDate).getTime();
      return diffMs <= 365 * 24 * 60 * 60 * 1000;
    },
    {
      message: "Gantt range cannot exceed 365 days",
      path: ["endDate"],
    }
  );

export type GanttFilters = z.infer<typeof ganttQuerySchema>;

export const ganttRangeToDays = timelineRangeToDays;
