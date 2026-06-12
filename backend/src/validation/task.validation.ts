import { z } from "zod";
import {
  TaskPriorityEnum,
  TaskRecurrenceFrequencyEnum,
  TaskRecurrenceFrequencyEnumType,
  TaskStatusEnum,
} from "../enums/task.enum";
import {
  commaSeparatedEnumArray,
  objectIdSchema,
  paginationSchema,
} from "./common.validation";

const titleSchema = z.string().trim().min(1).max(255);
const descriptionSchema = z.string().trim().optional();

const assignedToSchema = objectIdSchema("Assignee ID")
  .nullable()
  .optional();

const prioritySchema = z.enum(
  Object.values(TaskPriorityEnum) as [string, ...string[]]
);

const statusSchema = z.enum(
  Object.values(TaskStatusEnum) as [string, ...string[]]
);

const commaSeparatedObjectIdArray = (label: string, max = 20) =>
  z.preprocess((value) => {
    if (typeof value !== "string" || value.trim() === "") {
      return undefined;
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }, z.array(objectIdSchema(label)).max(max).optional());

const dueDateSchema = z
  .string()
  .trim()
  .optional()
  .refine(
    (val) => {
      return !val || !isNaN(Date.parse(val));
    },
    {
      message: "Invalid date format. Please provide a valid date string.",
    }
  );

const dueDateRangeSchema = z
  .string()
  .trim()
  .optional()
  .refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Invalid date format. Please provide a valid date string.",
  });

export const taskIdSchema = objectIdSchema("Task ID");
export const dependencyIdSchema = objectIdSchema("Dependency ID");
export const checklistItemIdSchema = objectIdSchema("Checklist item ID");

export const createTaskSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  priority: prioritySchema,
  status: statusSchema,
  assignedTo: assignedToSchema,
  dueDate: dueDateSchema,
});

export const updateTaskSchema = createTaskSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one task field must be provided",
  });

export const getTasksQuerySchema = paginationSchema.extend({
  projectId: objectIdSchema("Project ID").optional(),
  status: commaSeparatedEnumArray(
    Object.values(TaskStatusEnum) as [string, ...string[]]
  ),
  priority: commaSeparatedEnumArray(
    Object.values(TaskPriorityEnum) as [string, ...string[]]
  ),
  assignedTo: z.preprocess((value) => {
    if (typeof value !== "string" || value.trim() === "") {
      return undefined;
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }, z.array(objectIdSchema("Assignee ID")).max(20).optional()),
  keyword: z.string().trim().min(1).max(100).optional(),
  dueDate: dueDateSchema,
  dueDateFrom: dueDateRangeSchema,
  dueDateTo: dueDateRangeSchema,
});

export const getKanbanTasksQuerySchema = z.object({
  projectId: objectIdSchema("Project ID").optional(),
  status: statusSchema.optional(),
  priority: commaSeparatedEnumArray(
    Object.values(TaskPriorityEnum) as [string, ...string[]]
  ),
  assignedTo: commaSeparatedObjectIdArray("Assignee ID"),
  labelIds: commaSeparatedObjectIdArray("Label ID", 50),
  keyword: z.string().trim().min(1).max(100).optional(),
  columnLimit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().trim().min(1).max(500).optional(),
});

export const createSubtaskSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  priority: prioritySchema.optional(),
  assignedTo: assignedToSchema,
  dueDate: dueDateSchema,
});

export const addChecklistItemSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export const updateChecklistItemSchema = z
  .object({
    text: z.string().trim().min(1).max(500).optional(),
    completed: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one checklist field must be provided",
  });

export const replaceTaskLabelsSchema = z.object({
  labelIds: z.array(objectIdSchema("Label ID")).max(50).default([]),
});

export const addTaskDependencySchema = z.object({
  predecessorTaskId: taskIdSchema,
});

export const taskWatcherSchema = z.object({
  userId: objectIdSchema("Watcher user ID"),
});

export const updateTaskRecurrenceSchema = z.object({
  enabled: z.literal(true).default(true),
  frequency: z.enum(
    Object.values(TaskRecurrenceFrequencyEnum) as [
      TaskRecurrenceFrequencyEnumType,
      ...TaskRecurrenceFrequencyEnumType[]
    ]
  ),
  interval: z.coerce.number().int().min(1).max(365).default(1),
  endsAt: dueDateSchema.nullable(),
  maxOccurrences: z.coerce.number().int().min(1).max(500).nullable().optional(),
});

const scheduleDateSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Date must be a valid date string",
  });

export const updateTaskScheduleSchema = z
  .object({
    startDate: scheduleDateSchema.nullable(),
    endDate: scheduleDateSchema.nullable(),
  })
  .refine(
    (body) =>
      (body.startDate === null && body.endDate === null) ||
      (body.startDate !== null && body.endDate !== null),
    {
      message: "startDate and endDate must both be dates or both be null",
      path: ["endDate"],
    }
  )
  .refine(
    (body) => {
      if (body.startDate === null || body.endDate === null) return true;
      return new Date(body.startDate) <= new Date(body.endDate);
    },
    {
      message: "startDate must be before or equal to endDate",
      path: ["endDate"],
    }
  );
