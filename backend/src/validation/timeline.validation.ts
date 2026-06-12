import { z } from "zod";
import { TaskStatusEnum } from "../enums/task.enum";
import {
  commaSeparatedEnumArray,
  objectIdSchema,
} from "./common.validation";

export const timelineRangeEnum = {
  THIRTY_DAYS: "30d",
  NINETY_DAYS: "90d",
  ONE_EIGHTY_DAYS: "180d",
  THREE_SIXTY_FIVE_DAYS: "365d",
} as const;

export type TimelineRange =
  (typeof timelineRangeEnum)[keyof typeof timelineRangeEnum];

const rangeDays: Record<TimelineRange, number> = {
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "365d": 365,
};

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

export const timelineQuerySchema = z
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
      message: "Timeline range cannot exceed 365 days",
      path: ["endDate"],
    }
  );

export const timelineRangeToDays = (range: TimelineRange) => rangeDays[range];
