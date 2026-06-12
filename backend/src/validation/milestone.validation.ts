import { z } from "zod";
import { MilestoneStatusEnum, MilestoneStatusType } from "../enums/domain.enum";
import { objectIdSchema } from "./common.validation";

const milestoneStatusSchema = z.enum(
  Object.values(MilestoneStatusEnum) as [
    MilestoneStatusType,
    ...MilestoneStatusType[]
  ]
);

const optionalDateSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
    message: "Date must be a valid date string",
  });

export const milestoneIdSchema = objectIdSchema("Milestone ID");

const milestoneBodySchema = z.object({
  project: objectIdSchema("Project ID"),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  status: milestoneStatusSchema.default(MilestoneStatusEnum.PLANNED),
  startDate: optionalDateSchema,
  dueDate: optionalDateSchema,
  completedAt: optionalDateSchema,
});

export const createMilestoneSchema = milestoneBodySchema
  .refine(
    (body) =>
      !body.startDate ||
      !body.dueDate ||
      new Date(body.startDate) <= new Date(body.dueDate),
    {
      message: "Start date must be before or equal to due date",
      path: ["dueDate"],
    }
  );

export const updateMilestoneSchema = milestoneBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one milestone field must be provided",
  })
  .refine(
    (body) =>
      !body.startDate ||
      !body.dueDate ||
      new Date(body.startDate) <= new Date(body.dueDate),
    {
      message: "Start date must be before or equal to due date",
      path: ["dueDate"],
    }
  );
