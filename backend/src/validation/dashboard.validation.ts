import { z } from "zod";

export const DashboardRangeEnum = {
  SEVEN_DAYS: "7d",
  FOURTEEN_DAYS: "14d",
  THIRTY_DAYS: "30d",
  NINETY_DAYS: "90d",
} as const;

export type DashboardRange =
  (typeof DashboardRangeEnum)[keyof typeof DashboardRangeEnum];

export const dashboardRangeSchema = z
  .object({
    range: z
      .enum(Object.values(DashboardRangeEnum) as [DashboardRange, ...DashboardRange[]])
      .default(DashboardRangeEnum.THIRTY_DAYS),
  })
  .default({ range: DashboardRangeEnum.THIRTY_DAYS });
