import mongoose, { ClientSession } from "mongoose";
import {
  ActivityTypeEnum,
  AuditActionEnum,
  DomainEntityTypeEnum,
  DomainEventTypeEnum,
} from "../enums/domain.enum";
import {
  TaskDependencyTypeEnum,
  TaskPriorityEnum,
  TaskPriorityEnumType,
  TaskRecurrenceFrequencyEnum,
  TaskRecurrenceFrequencyEnumType,
  TaskStatusEnum,
  TaskStatusEnumType,
  TaskWatcherSourceEnum,
  TaskWatcherSourceEnumType,
} from "../enums/task.enum";
import LabelModel from "../models/label.model";
import MemberModel from "../models/member.model";
import ProjectModel from "../models/project.model";
import TaskDependencyModel from "../models/task-dependency.model";
import TaskModel, { TaskDocument, TaskRecurrence } from "../models/task.model";
import TaskWatcherModel from "../models/task-watcher.model";
import { RequestContext } from "../types/request-context";
import { BadRequestException, NotFoundException } from "../utils/appError";
import { recordActivity } from "./activity.service";
import { recordAuditLog } from "./audit-log.service";
import { emitDomainEvent } from "./domain-event.service";
import {
  deleteStoredFiles,
  softDeleteFilesForTarget,
} from "./file-cleanup.service";
import { detachTimeEntriesForTasks } from "./time.service";

const MAX_SUBTASK_DEPTH = 3;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getObjectId = (id: string) => new mongoose.Types.ObjectId(id);

const taskIdString = (task: Pick<TaskDocument, "_id">) => task._id.toString();

const toDateOrNull = (value?: string | Date | null) =>
  value ? new Date(value) : null;

const serializeTaskSchedule = (task: TaskDocument) => ({
  startDate: task.startDate?.toISOString() ?? null,
  endDate: task.endDate?.toISOString() ?? null,
  dueDate: task.dueDate?.toISOString() ?? null,
});

const ensureProject = async (
  workspaceId: string,
  projectId: string,
  session?: ClientSession
) => {
  const project = await ProjectModel.findOne({
    _id: projectId,
    workspace: workspaceId,
  }).session(session || null);

  if (!project) {
    throw new NotFoundException(
      "Project not found or does not belong to this workspace"
    );
  }

  return project;
};

const ensureTask = async (
  workspaceId: string,
  taskId: string,
  session?: ClientSession
) => {
  const task = await TaskModel.findOne({
    _id: taskId,
    workspace: workspaceId,
  }).session(session || null);

  if (!task) {
    throw new NotFoundException(
      "Task not found or does not belong to the specified workspace"
    );
  }

  return task;
};

const ensureWorkspaceMember = async (
  workspaceId: string,
  userId: string,
  message = "User is not a member of this workspace"
) => {
  const member = await MemberModel.exists({
    workspaceId,
    userId,
  });

  if (!member) {
    throw new BadRequestException(message);
  }
};

const getTaskWithActiveLabels = (query: Record<string, unknown>) =>
  TaskModel.findOne(query)
    .populate("assignedTo", "_id name profilePicture")
    .populate("project", "_id emoji name")
    .populate({
      path: "labels",
      match: { deletedAt: null },
      select: "_id name color description",
    });

const validateLabels = async (workspaceId: string, labelIds: string[]) => {
  const uniqueLabelIds = Array.from(new Set(labelIds));

  if (uniqueLabelIds.length === 0) {
    return [];
  }

  const labels = await LabelModel.find({
    _id: { $in: uniqueLabelIds },
    workspace: workspaceId,
    deletedAt: null,
  }).select("_id");

  if (labels.length !== uniqueLabelIds.length) {
    throw new BadRequestException(
      "All labels must be active labels in this workspace"
    );
  }

  return uniqueLabelIds.map(getObjectId);
};

const upsertWatcher = async ({
  workspaceId,
  taskId,
  userId,
  addedBy,
  source,
  session,
}: {
  workspaceId: string;
  taskId: string;
  userId: string;
  addedBy: string;
  source: TaskWatcherSourceEnumType;
  session?: ClientSession;
}) => {
  await ensureWorkspaceMember(workspaceId, userId);

  const existing = await TaskWatcherModel.findOne({
    workspace: workspaceId,
    task: taskId,
    user: userId,
    deletedAt: null,
  }).session(session || null);

  if (existing) {
    if (source === TaskWatcherSourceEnum.MANUAL && existing.source !== source) {
      existing.source = source;
      existing.addedBy = getObjectId(addedBy);
      await existing.save({ session });
    }
    return existing;
  }

  const [watcher] = await TaskWatcherModel.create(
    [
      {
        workspace: getObjectId(workspaceId),
        task: getObjectId(taskId),
        user: getObjectId(userId),
        addedBy: getObjectId(addedBy),
        source,
      },
    ],
    { session }
  );

  return watcher;
};

const syncDefaultWatchers = async (
  workspaceId: string,
  task: TaskDocument,
  actorId: string,
  session?: ClientSession
) => {
  await upsertWatcher({
    workspaceId,
    taskId: taskIdString(task),
    userId: task.createdBy.toString(),
    addedBy: actorId,
    source: TaskWatcherSourceEnum.CREATOR,
    session,
  });

  if (task.assignedTo) {
    await upsertWatcher({
      workspaceId,
      taskId: taskIdString(task),
      userId: task.assignedTo.toString(),
      addedBy: actorId,
      source: TaskWatcherSourceEnum.ASSIGNEE,
      session,
    });
  }
};

const addInterval = (
  date: Date,
  frequency: TaskRecurrenceFrequencyEnumType,
  interval: number
) => {
  const next = new Date(date);

  if (frequency === TaskRecurrenceFrequencyEnum.DAILY) {
    next.setDate(next.getDate() + interval);
  } else if (frequency === TaskRecurrenceFrequencyEnum.WEEKLY) {
    next.setDate(next.getDate() + interval * 7);
  } else {
    next.setMonth(next.getMonth() + interval);
  }

  return next;
};

const shouldGenerateNextOccurrence = (
  recurrence: TaskRecurrence,
  nextDueDate: Date
) => {
  if (!recurrence.enabled || !recurrence.frequency) {
    return false;
  }

  const nextOccurrenceIndex = (recurrence.occurrenceIndex || 1) + 1;

  if (
    recurrence.maxOccurrences &&
    nextOccurrenceIndex > recurrence.maxOccurrences
  ) {
    return false;
  }

  if (recurrence.endsAt && nextDueDate > recurrence.endsAt) {
    return false;
  }

  return true;
};

const generateNextOccurrenceIfNeeded = async (
  workspaceId: string,
  completedTask: TaskDocument,
  actorId: string,
  session: ClientSession
) => {
  const recurrence = completedTask.recurrence;

  if (!recurrence.enabled || !recurrence.frequency) {
    return null;
  }

  const existing = await TaskModel.findOne({
    workspace: workspaceId,
    generatedFromTaskId: completedTask._id,
  }).session(session);

  if (existing) {
    return existing;
  }

  const nextDueDate = addInterval(
    completedTask.dueDate || new Date(),
    recurrence.frequency,
    recurrence.interval || 1
  );

  if (!shouldGenerateNextOccurrence(recurrence, nextDueDate)) {
    return null;
  }

  const nextOccurrenceIndex = (recurrence.occurrenceIndex || 1) + 1;
  const seriesRoot = recurrence.seriesRoot || completedTask._id;

  const [nextTask] = await TaskModel.create(
    [
      {
        title: completedTask.title,
        description: completedTask.description,
        project: completedTask.project,
        workspace: completedTask.workspace,
        priority: completedTask.priority,
        status: TaskStatusEnum.TODO,
        completedAt: null,
        assignedTo: completedTask.assignedTo,
        createdBy: getObjectId(actorId),
        dueDate: nextDueDate,
        startDate: new Date(),
        endDate: nextDueDate,
        labels: completedTask.labels,
        recurrence: {
          enabled: true,
          frequency: recurrence.frequency,
          interval: recurrence.interval,
          endsAt: recurrence.endsAt,
          maxOccurrences: recurrence.maxOccurrences,
          occurrenceIndex: nextOccurrenceIndex,
          seriesRoot,
          previousOccurrence: completedTask._id,
        },
        generatedFromTaskId: completedTask._id,
      },
    ],
    { session }
  );

  await syncDefaultWatchers(workspaceId, nextTask, actorId, session);

  return nextTask;
};

const dependencySummaryForTasks = async (
  workspaceId: string,
  taskIds: string[]
) => {
  const uniqueTaskIds = Array.from(new Set(taskIds));

  if (uniqueTaskIds.length === 0) {
    return new Map<string, {
      blockingCount: number;
      blockedByCount: number;
      incompleteBlockingCount: number;
      isBlocked: boolean;
    }>();
  }

  const dependencies = await TaskDependencyModel.find({
    workspace: workspaceId,
    deletedAt: null,
    $or: [
      { predecessorTask: { $in: uniqueTaskIds } },
      { successorTask: { $in: uniqueTaskIds } },
    ],
  })
    .populate("predecessorTask", "_id status")
    .lean();

  const summary = new Map<string, {
    blockingCount: number;
    blockedByCount: number;
    incompleteBlockingCount: number;
    isBlocked: boolean;
  }>();

  for (const taskId of uniqueTaskIds) {
    summary.set(taskId, {
      blockingCount: 0,
      blockedByCount: 0,
      incompleteBlockingCount: 0,
      isBlocked: false,
    });
  }

  for (const dependency of dependencies) {
    const predecessorId = dependency.predecessorTask?._id?.toString();
    const successorId = dependency.successorTask.toString();

    if (predecessorId && summary.has(predecessorId)) {
      summary.get(predecessorId)!.blockingCount += 1;
    }

    if (summary.has(successorId)) {
      const current = summary.get(successorId)!;
      current.blockedByCount += 1;
      const predecessor = dependency.predecessorTask as unknown as {
        status?: string;
      };
      if (predecessor.status !== TaskStatusEnum.DONE) {
        current.incompleteBlockingCount += 1;
        current.isBlocked = true;
      }
    }
  }

  return summary;
};

const attachDependencySummary = async <T extends { _id: unknown }>(
  workspaceId: string,
  tasks: T[]
) => {
  const taskIds = tasks.map((task) => String(task._id));
  const summary = await dependencySummaryForTasks(workspaceId, taskIds);

  return tasks.map((task) => ({
    ...task,
    dependencySummary: summary.get(String(task._id)) || {
      blockingCount: 0,
      blockedByCount: 0,
      incompleteBlockingCount: 0,
      isBlocked: false,
    },
  }));
};

const encodeKanbanCursor = (task: { _id: unknown; createdAt?: Date | string }) => {
  const cursorPayload = {
    createdAt: new Date(task.createdAt || new Date()).toISOString(),
    id: String(task._id),
  };

  return Buffer.from(JSON.stringify(cursorPayload)).toString("base64url");
};

const decodeKanbanCursor = (cursor?: string) => {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as { createdAt?: string; id?: string };

    if (
      !parsed.createdAt ||
      !parsed.id ||
      Number.isNaN(Date.parse(parsed.createdAt)) ||
      !mongoose.Types.ObjectId.isValid(parsed.id)
    ) {
      throw new Error("Invalid cursor");
    }

    return {
      createdAt: new Date(parsed.createdAt),
      id: getObjectId(parsed.id),
    };
  } catch {
    throw new BadRequestException("Invalid Kanban cursor");
  }
};

const buildKanbanColumnQuery = (
  baseQuery: Record<string, unknown>,
  status: TaskStatusEnumType,
  cursor?: ReturnType<typeof decodeKanbanCursor>
) => {
  const query: Record<string, unknown> = {
    ...baseQuery,
    status,
  };

  if (cursor) {
    query.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      {
        createdAt: cursor.createdAt,
        _id: { $lt: cursor.id },
      },
    ];
  }

  return query;
};

const collectDescendantTaskIds = async (
  workspaceId: string,
  taskId: string,
  session: ClientSession
) => {
  const taskIds = [taskId];
  let frontier = [taskId];

  while (frontier.length > 0) {
    const children = await TaskModel.find({
      workspace: workspaceId,
      parentTask: { $in: frontier },
    })
      .select("_id")
      .session(session);

    frontier = children.map((child) => child._id.toString());
    taskIds.push(...frontier);
  }

  return Array.from(new Set(taskIds));
};

export const createTaskService = async (
  workspaceId: string,
  projectId: string,
  userId: string,
  body: {
    title: string;
    description?: string;
    priority: string;
    status: string;
    assignedTo?: string | null;
    dueDate?: string;
  },
  context?: RequestContext
) => {
  const { title, description, priority, status, assignedTo, dueDate } = body;
  const dueDateValue = toDateOrNull(dueDate);
  const scheduleStartDate = dueDateValue ? new Date() : null;

  await ensureProject(workspaceId, projectId);

  if (assignedTo) {
    await ensureWorkspaceMember(
      workspaceId,
      assignedTo,
      "Assigned user is not a member of this workspace"
    );
  }

  const task = new TaskModel({
    title,
    description,
    priority: priority || TaskPriorityEnum.MEDIUM,
    status: status || TaskStatusEnum.TODO,
    assignedTo,
    createdBy: userId,
    workspace: workspaceId,
    project: projectId,
    startDate: scheduleStartDate,
    endDate: dueDateValue,
    dueDate: dueDateValue,
    completedAt:
      (status || TaskStatusEnum.TODO) === TaskStatusEnum.DONE ? new Date() : null,
  });

  await task.save();
  await syncDefaultWatchers(workspaceId, task, userId);

  if (context) {
    await emitDomainEvent({
      type: DomainEventTypeEnum.TASK_CREATED,
      context,
      entityType: DomainEntityTypeEnum.TASK,
      entityId: task._id.toString(),
      target: {
        type: DomainEntityTypeEnum.TASK,
        id: task._id.toString(),
      },
      metadata: {
        projectId,
        assignedTo: task.assignedTo?.toString() ?? null,
        assignmentChanged: Boolean(task.assignedTo),
        title: task.title,
      },
      occurredAt: new Date(),
    });
  }

  return { task };
};

export const updateTaskService = async (
  workspaceId: string,
  projectId: string,
  taskId: string,
  body: {
    title?: string;
    description?: string;
    priority?: string;
    status?: string;
    assignedTo?: string | null;
    dueDate?: string;
  },
  context?: RequestContext
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let updatedTask: TaskDocument | null = null;
  let generatedTask: TaskDocument | null = null;
  let previousAssignedTo: string | null = null;
  let materialChangeTypes: string[] = [];
  let changedFields: string[] = [];
  let previousStatus: string | null = null;
  let previousPriority: string | null = null;
  let previousStartDate: string | null = null;
  let previousEndDate: string | null = null;

  try {
    await ensureProject(workspaceId, projectId, session);

    const task = await TaskModel.findOne({
      _id: taskId,
      workspace: workspaceId,
      project: projectId,
    }).session(session);

    if (!task) {
      throw new NotFoundException(
        "Task not found or does not belong to this project"
      );
    }

    if (body.assignedTo) {
      await ensureWorkspaceMember(
        workspaceId,
        body.assignedTo,
        "Assigned user is not a member of this workspace"
      );
    }

    previousAssignedTo = task.assignedTo?.toString() ?? null;
    previousStatus = task.status;
    previousPriority = task.priority;
    const previousTitle = task.title;
    const previousDescription = task.description ?? null;
    const previousDueDate = task.dueDate?.toISOString() ?? null;
    previousStartDate = task.startDate?.toISOString() ?? null;
    previousEndDate = task.endDate?.toISOString() ?? null;

    if (body.title !== undefined) task.title = body.title;
    if (body.description !== undefined) task.description = body.description;
    if (body.priority !== undefined) {
      task.priority = body.priority as TaskPriorityEnumType;
    }
    if (body.status !== undefined) {
      task.status = body.status as TaskStatusEnumType;
    }
    if (body.assignedTo !== undefined) {
      task.assignedTo = body.assignedTo ? getObjectId(body.assignedTo) : null;
    }
    if (body.dueDate !== undefined) {
      const nextDueDate = toDateOrNull(body.dueDate);
      task.dueDate = nextDueDate;
      task.endDate = nextDueDate;
      task.startDate = nextDueDate
        ? task.startDate || task.createdAt || new Date()
        : null;
    }

    if (
      previousStatus !== TaskStatusEnum.DONE &&
      task.status === TaskStatusEnum.DONE
    ) {
      task.completedAt = new Date();
    } else if (
      previousStatus === TaskStatusEnum.DONE &&
      task.status !== TaskStatusEnum.DONE
    ) {
      task.completedAt = null;
    }

    await task.save({ session });
    await syncDefaultWatchers(
      workspaceId,
      task,
      context?.userId || task.createdBy.toString(),
      session
    );

    const assignedTo = task.assignedTo?.toString() ?? null;
    const startDate = task.startDate?.toISOString() ?? null;
    const endDate = task.endDate?.toISOString() ?? null;
    const dueDate = task.dueDate?.toISOString() ?? null;
    if (previousTitle !== task.title) changedFields.push("title");
    if (previousDescription !== (task.description ?? null)) {
      changedFields.push("description");
    }
    if (previousStatus !== task.status) changedFields.push("status");
    if (previousPriority !== task.priority) changedFields.push("priority");
    if (previousAssignedTo !== assignedTo) changedFields.push("assignedTo");
    if (previousStartDate !== startDate) changedFields.push("startDate");
    if (previousEndDate !== endDate) changedFields.push("endDate");
    if (previousDueDate !== dueDate) changedFields.push("dueDate");
    if (previousStatus !== task.status) materialChangeTypes.push("status");
    if (previousPriority !== task.priority) materialChangeTypes.push("priority");
    if (previousAssignedTo !== assignedTo) materialChangeTypes.push("assignee");
    const completed = previousStatus !== TaskStatusEnum.DONE && task.status === TaskStatusEnum.DONE;
    if (completed) materialChangeTypes.push("completed");

    if (completed) {
      generatedTask = await generateNextOccurrenceIfNeeded(
        workspaceId,
        task,
        context?.userId || task.createdBy.toString(),
        session
      );
    }

    await session.commitTransaction();
    updatedTask = task;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  if (!updatedTask) {
    throw new BadRequestException("Failed to update task");
  }

  if (context) {
    const assignedTo = updatedTask.assignedTo?.toString() ?? null;
    await emitDomainEvent({
      type: DomainEventTypeEnum.TASK_UPDATED,
      context,
      entityType: DomainEntityTypeEnum.TASK,
      entityId: updatedTask._id.toString(),
      target: {
        type: DomainEntityTypeEnum.TASK,
        id: updatedTask._id.toString(),
      },
      metadata: {
        projectId,
        previousAssignedTo,
        assignedTo,
        assignmentChanged:
          previousAssignedTo !== assignedTo && Boolean(assignedTo),
        title: updatedTask.title,
        previousStatus,
        status: updatedTask.status,
        previousPriority,
        priority: updatedTask.priority,
        materialChangeTypes,
        changedFields,
        generatedTaskId: generatedTask?._id.toString() ?? null,
      },
      occurredAt: new Date(),
    });

    if (generatedTask) {
      await recordAuditLog(context, {
        action: AuditActionEnum.CREATED,
        entityType: DomainEntityTypeEnum.TASK,
        entityId: generatedTask._id.toString(),
        after: {
          generatedFromTaskId: updatedTask._id.toString(),
        },
        metadata: {
          scope: "recurrence",
        },
      });
    }
  }

  return { updatedTask, generatedTask };
};

export const updateTaskScheduleService = async (
  context: RequestContext,
  taskId: string,
  body: {
    startDate: string | null;
    endDate: string | null;
  }
) => {
  const isClearing = body.startDate === null && body.endDate === null;
  const nextStartDate = isClearing ? null : toDateOrNull(body.startDate);
  const nextEndDate = isClearing ? null : toDateOrNull(body.endDate);

  if (!isClearing && (!nextStartDate || !nextEndDate)) {
    throw new BadRequestException("Both startDate and endDate are required");
  }

  if (nextStartDate && nextEndDate && nextStartDate > nextEndDate) {
    throw new BadRequestException("startDate must be before or equal to endDate");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  let updatedTask: TaskDocument | null = null;
  let projectId: string | null = null;
  let changedFields: string[] = [];

  try {
    const task = await ensureTask(context.workspaceId, taskId, session);
    projectId = task.project.toString();

    const before = serializeTaskSchedule(task);
    task.startDate = nextStartDate;
    task.endDate = nextEndDate;
    task.dueDate = nextEndDate;

    const after = serializeTaskSchedule(task);
    if (before.startDate !== after.startDate) changedFields.push("startDate");
    if (before.endDate !== after.endDate) changedFields.push("endDate");
    if (before.dueDate !== after.dueDate) changedFields.push("dueDate");

    await task.save({ session });
    await recordAuditLog(
      context,
      {
        action: AuditActionEnum.UPDATED,
        entityType: DomainEntityTypeEnum.TASK,
        entityId: task._id.toString(),
        before,
        after,
        metadata: {
          scope: "schedule",
        },
      },
      session
    );
    await recordActivity(
      context,
      {
        type: ActivityTypeEnum.TASK_SCHEDULE_UPDATED,
        entityType: DomainEntityTypeEnum.TASK,
        entityId: task._id.toString(),
        projectId,
        taskId: task._id.toString(),
        summary: "Task schedule updated",
        metadata: {
          before,
          after,
        },
      },
      session
    );

    await session.commitTransaction();
    updatedTask = task;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  if (!updatedTask || !projectId) {
    throw new BadRequestException("Failed to update task schedule");
  }

  await emitDomainEvent({
    type: DomainEventTypeEnum.TASK_UPDATED,
    context,
    entityType: DomainEntityTypeEnum.TASK,
    entityId: updatedTask._id.toString(),
    target: {
      type: DomainEntityTypeEnum.TASK,
      id: updatedTask._id.toString(),
    },
    metadata: {
      projectId,
      title: updatedTask.title,
      changedFields,
      materialChangeTypes: [],
    },
    occurredAt: new Date(),
  });

  return { task: updatedTask };
};

export const getAllTasksService = async (
  workspaceId: string,
  filters: {
    projectId?: string;
    status?: string[];
    priority?: string[];
    assignedTo?: string[];
    keyword?: string;
    dueDate?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
  },
  pagination: {
    pageSize: number;
    pageNumber: number;
  }
) => {
  const query: Record<string, unknown> = {
    workspace: workspaceId,
  };

  if (filters.projectId) {
    query.project = filters.projectId;
  }

  if (filters.status && filters.status.length > 0) {
    query.status = { $in: filters.status };
  }

  if (filters.priority && filters.priority.length > 0) {
    query.priority = { $in: filters.priority };
  }

  if (filters.assignedTo && filters.assignedTo.length > 0) {
    query.assignedTo = { $in: filters.assignedTo };
  }

  if (filters.keyword) {
    query.title = { $regex: escapeRegExp(filters.keyword), $options: "i" };
  }

  if (filters.dueDateFrom || filters.dueDateTo) {
    query.dueDate = {
      ...(filters.dueDateFrom ? { $gte: new Date(filters.dueDateFrom) } : {}),
      ...(filters.dueDateTo ? { $lte: new Date(filters.dueDateTo) } : {}),
    };
  } else if (filters.dueDate) {
    query.dueDate = {
      $eq: new Date(filters.dueDate),
    };
  }

  const { pageSize, pageNumber } = pagination;
  const skip = (pageNumber - 1) * pageSize;

  const [tasks, totalCount] = await Promise.all([
    TaskModel.find(query)
      .skip(skip)
      .limit(pageSize)
      .sort({ createdAt: -1 })
      .populate("assignedTo", "_id name profilePicture")
      .populate("project", "_id emoji name")
      .populate({
        path: "labels",
        match: { deletedAt: null },
        select: "_id name color description",
      })
      .lean(),
    TaskModel.countDocuments(query),
  ]);

  const tasksWithDependencySummary = await attachDependencySummary(
    workspaceId,
    tasks
  );

  return {
    tasks: tasksWithDependencySummary,
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      skip,
      limit: pageSize,
    },
  };
};

export const getKanbanTasksService = async (
  workspaceId: string,
  filters: {
    projectId?: string;
    status?: string;
    priority?: string[];
    assignedTo?: string[];
    labelIds?: string[];
    keyword?: string;
    cursor?: string;
    columnLimit: number;
  }
) => {
  const baseQuery: Record<string, unknown> = {
    workspace: workspaceId,
  };

  if (filters.projectId) {
    await ensureProject(workspaceId, filters.projectId);
    baseQuery.project = filters.projectId;
  }

  if (filters.priority && filters.priority.length > 0) {
    baseQuery.priority = { $in: filters.priority };
  }

  if (filters.assignedTo && filters.assignedTo.length > 0) {
    baseQuery.assignedTo = { $in: filters.assignedTo };
  }

  if (filters.labelIds && filters.labelIds.length > 0) {
    const activeLabelIds = await validateLabels(workspaceId, filters.labelIds);
    baseQuery.labels = { $in: activeLabelIds };
  }

  if (filters.keyword) {
    baseQuery.title = { $regex: escapeRegExp(filters.keyword), $options: "i" };
  }

  const statuses = Object.values(TaskStatusEnum) as TaskStatusEnumType[];
  const requestedStatuses = filters.status
    ? [filters.status as TaskStatusEnumType]
    : statuses;
  const cursor = decodeKanbanCursor(filters.cursor);

  if (cursor && !filters.status) {
    throw new BadRequestException(
      "A status is required when requesting the next Kanban cursor page"
    );
  }

  const countEntries = await Promise.all(
    statuses.map(async (status) => {
      const totalCount = await TaskModel.countDocuments({
        ...baseQuery,
        status,
      });

      return [status, totalCount] as const;
    })
  );

  const columnCounts = countEntries.reduce<Record<string, number>>(
    (counts, [status, totalCount]) => {
      counts[status] = totalCount;
      return counts;
    },
    {}
  );

  const columns = await Promise.all(
    requestedStatuses.map(async (status) => {
      const columnQuery = buildKanbanColumnQuery(
        baseQuery,
        status,
        filters.status === status ? cursor : null
      );

      const tasks = await TaskModel.find(columnQuery)
        .sort({ createdAt: -1, _id: -1 })
        .limit(filters.columnLimit + 1)
        .populate("assignedTo", "_id name profilePicture")
        .populate("project", "_id emoji name")
        .populate({
          path: "labels",
          match: { deletedAt: null },
          select: "_id name color description",
        })
        .lean();

      const visibleTasks = tasks.slice(0, filters.columnLimit);
      const tasksWithDependencySummary = await attachDependencySummary(
        workspaceId,
        visibleTasks
      );

      return {
        status,
        totalCount: columnCounts[status] || 0,
        hasMore: tasks.length > filters.columnLimit,
        nextCursor:
          tasks.length > filters.columnLimit && visibleTasks.length > 0
            ? encodeKanbanCursor(visibleTasks[visibleTasks.length - 1])
            : null,
        tasks: tasksWithDependencySummary.map((task) => ({
          ...task,
          isBlocked: task.dependencySummary.isBlocked,
          blockedByCount: task.dependencySummary.blockedByCount,
        })),
      };
    })
  );

  return {
    columns,
    columnCounts,
  };
};

export const getTaskByIdService = async (
  workspaceId: string,
  projectId: string,
  taskId: string
) => {
  await ensureProject(workspaceId, projectId);

  const task = await getTaskWithActiveLabels({
    _id: taskId,
    workspace: workspaceId,
    project: projectId,
  }).lean();

  if (!task) {
    throw new NotFoundException("Task not found.");
  }

  const [taskWithSummary] = await attachDependencySummary(workspaceId, [task]);

  return taskWithSummary;
};

export const createSubtaskService = async (
  workspaceId: string,
  parentTaskId: string,
  userId: string,
  body: {
    title: string;
    description?: string;
    priority?: string;
    assignedTo?: string | null;
    dueDate?: string;
  },
  context?: RequestContext
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let subtask: TaskDocument | null = null;

  try {
    const parentTask = await ensureTask(workspaceId, parentTaskId, session);

    if (parentTask.subtaskDepth >= MAX_SUBTASK_DEPTH) {
      throw new BadRequestException("Maximum subtask depth is 3");
    }

    if (body.assignedTo) {
      await ensureWorkspaceMember(
        workspaceId,
        body.assignedTo,
        "Assigned user is not a member of this workspace"
      );
    }

    const subtaskOrder = await TaskModel.countDocuments({
      workspace: workspaceId,
      parentTask: parentTask._id,
    }).session(session);
    const dueDateValue = toDateOrNull(body.dueDate);

    const [createdSubtask] = await TaskModel.create(
      [
        {
          title: body.title,
          description: body.description,
          priority: body.priority || parentTask.priority || TaskPriorityEnum.MEDIUM,
          status: TaskStatusEnum.TODO,
          assignedTo: body.assignedTo || null,
          createdBy: getObjectId(userId),
          workspace: getObjectId(workspaceId),
          project: parentTask.project,
          startDate: dueDateValue ? new Date() : null,
          endDate: dueDateValue,
          dueDate: dueDateValue,
          parentTask: parentTask._id,
          rootTask: parentTask.rootTask || parentTask._id,
          subtaskDepth: parentTask.subtaskDepth + 1,
          subtaskOrder,
        },
      ],
      { session }
    );

    await syncDefaultWatchers(workspaceId, createdSubtask, userId, session);
    await session.commitTransaction();
    subtask = createdSubtask;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  if (!subtask) {
    throw new BadRequestException("Failed to create subtask");
  }

  if (context) {
    await recordAuditLog(context, {
      action: AuditActionEnum.CREATED,
      entityType: DomainEntityTypeEnum.TASK,
      entityId: subtask._id.toString(),
      after: {
        parentTask: parentTaskId,
      },
      metadata: {
        scope: "subtask",
      },
    });
    await recordActivity(context, {
      type: ActivityTypeEnum.SUBTASK_CREATED,
      entityType: DomainEntityTypeEnum.TASK,
      entityId: subtask._id.toString(),
      projectId: subtask.project.toString(),
      taskId: subtask._id.toString(),
      summary: "Subtask created",
      metadata: {
        parentTaskId,
      },
    });
  }

  return { subtask };
};

export const listSubtasksService = async (
  workspaceId: string,
  parentTaskId: string
) => {
  await ensureTask(workspaceId, parentTaskId);

  const subtasks = await TaskModel.find({
    workspace: workspaceId,
    parentTask: parentTaskId,
  })
    .sort({ subtaskOrder: 1, createdAt: 1 })
    .populate("assignedTo", "_id name profilePicture")
    .populate({
      path: "labels",
      match: { deletedAt: null },
      select: "_id name color description",
    })
    .lean();

  return {
    subtasks: await attachDependencySummary(workspaceId, subtasks),
  };
};

export const addChecklistItemService = async (
  context: RequestContext,
  taskId: string,
  text: string
) => {
  const task = await ensureTask(context.workspaceId, taskId);
  const order = task.checklist.length;

  task.checklist.push({
    _id: new mongoose.Types.ObjectId(),
    text,
    order,
    completed: false,
    completedAt: null,
    completedBy: null,
    createdBy: getObjectId(context.userId),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await task.save();

  await recordAuditLog(context, {
    action: AuditActionEnum.UPDATED,
    entityType: DomainEntityTypeEnum.TASK,
    entityId: taskId,
    metadata: { scope: "checklist", action: "created" },
  });

  return { checklist: task.checklist };
};

export const updateChecklistItemService = async (
  context: RequestContext,
  taskId: string,
  itemId: string,
  body: { text?: string; completed?: boolean }
) => {
  const task = await ensureTask(context.workspaceId, taskId);
  const item = task.checklist.find(
    (checklistItem) => checklistItem._id.toString() === itemId
  );

  if (!item) {
    throw new NotFoundException("Checklist item not found");
  }

  if (body.text !== undefined) item.text = body.text;
  if (body.completed !== undefined) {
    item.completed = body.completed;
    item.completedAt = body.completed ? new Date() : null;
    item.completedBy = body.completed ? getObjectId(context.userId) : null;
  }
  item.updatedAt = new Date();
  await task.save();

  await recordAuditLog(context, {
    action: AuditActionEnum.UPDATED,
    entityType: DomainEntityTypeEnum.TASK,
    entityId: taskId,
    metadata: { scope: "checklist", action: "updated", itemId },
  });

  return { checklist: task.checklist };
};

export const deleteChecklistItemService = async (
  context: RequestContext,
  taskId: string,
  itemId: string
) => {
  const task = await ensureTask(context.workspaceId, taskId);
  const beforeCount = task.checklist.length;
  task.checklist = task.checklist.filter(
    (checklistItem) => checklistItem._id.toString() !== itemId
  );

  if (task.checklist.length === beforeCount) {
    throw new NotFoundException("Checklist item not found");
  }

  task.checklist.forEach((item, index) => {
    item.order = index;
  });
  await task.save();

  await recordAuditLog(context, {
    action: AuditActionEnum.UPDATED,
    entityType: DomainEntityTypeEnum.TASK,
    entityId: taskId,
    metadata: { scope: "checklist", action: "deleted", itemId },
  });

  return { checklist: task.checklist };
};

export const replaceTaskLabelsService = async (
  context: RequestContext,
  taskId: string,
  labelIds: string[]
) => {
  const task = await ensureTask(context.workspaceId, taskId);
  const labels = await validateLabels(context.workspaceId, labelIds);
  task.labels = labels;
  await task.save();

  await recordAuditLog(context, {
    action: AuditActionEnum.UPDATED,
    entityType: DomainEntityTypeEnum.TASK,
    entityId: taskId,
    after: { labelIds },
    metadata: { scope: "labels" },
  });

  return {
    task: await getTaskWithActiveLabels({
      _id: taskId,
      workspace: context.workspaceId,
    }),
  };
};

const pathExists = async (
  workspaceId: string,
  startTaskId: string,
  targetTaskId: string
) => {
  const visited = new Set<string>();
  let frontier = [startTaskId];

  while (frontier.length > 0) {
    if (frontier.includes(targetTaskId)) {
      return true;
    }

    const dependencies = await TaskDependencyModel.find({
      workspace: workspaceId,
      predecessorTask: { $in: frontier },
      deletedAt: null,
    }).select("successorTask");

    visited.forEach((id) => {
      frontier = frontier.filter((frontierId) => frontierId !== id);
    });

    frontier = dependencies
      .map((dependency) => dependency.successorTask.toString())
      .filter((id) => !visited.has(id));
    frontier.forEach((id) => visited.add(id));
  }

  return false;
};

export const listTaskDependenciesService = async (
  workspaceId: string,
  taskId: string
) => {
  await ensureTask(workspaceId, taskId);

  const dependencies = await TaskDependencyModel.find({
    workspace: workspaceId,
    deletedAt: null,
    $or: [{ predecessorTask: taskId }, { successorTask: taskId }],
  })
    .populate("predecessorTask", "_id title status taskCode")
    .populate("successorTask", "_id title status taskCode")
    .sort({ createdAt: -1 })
    .lean();
  const [summary] = Array.from(
    (await dependencySummaryForTasks(workspaceId, [taskId])).values()
  );

  return { dependencies, dependencySummary: summary };
};

export const addTaskDependencyService = async (
  context: RequestContext,
  successorTaskId: string,
  predecessorTaskId: string
) => {
  if (successorTaskId === predecessorTaskId) {
    throw new BadRequestException("A task cannot depend on itself");
  }

  const [successorTask, predecessorTask] = await Promise.all([
    ensureTask(context.workspaceId, successorTaskId),
    ensureTask(context.workspaceId, predecessorTaskId),
  ]);

  if (
    successorTask.workspace.toString() !== predecessorTask.workspace.toString()
  ) {
    throw new BadRequestException("Task dependencies cannot cross workspaces");
  }

  const existing = await TaskDependencyModel.findOne({
    workspace: context.workspaceId,
    predecessorTask: predecessorTaskId,
    successorTask: successorTaskId,
    deletedAt: null,
  });

  if (existing) {
    throw new BadRequestException("Task dependency already exists");
  }

  if (
    await pathExists(context.workspaceId, successorTaskId, predecessorTaskId)
  ) {
    throw new BadRequestException("Task dependency would create a cycle");
  }

  const dependency = await TaskDependencyModel.create({
    workspace: getObjectId(context.workspaceId),
    predecessorTask: predecessorTask._id,
    successorTask: successorTask._id,
    type: TaskDependencyTypeEnum.FINISH_TO_START,
    createdBy: getObjectId(context.userId),
  });

  await recordAuditLog(context, {
    action: AuditActionEnum.CREATED,
    entityType: DomainEntityTypeEnum.TASK_DEPENDENCY,
    entityId: dependency._id.toString(),
    after: {
      predecessorTaskId,
      successorTaskId,
      type: TaskDependencyTypeEnum.FINISH_TO_START,
    },
  });

  return { dependency };
};

export const removeTaskDependencyService = async (
  context: RequestContext,
  dependencyId: string
) => {
  const dependency = await TaskDependencyModel.findOneAndUpdate(
    {
      _id: dependencyId,
      workspace: context.workspaceId,
      deletedAt: null,
    },
    {
      $set: {
        deletedAt: new Date(),
        deletedBy: getObjectId(context.userId),
      },
    },
    { new: true }
  );

  if (!dependency) {
    throw new NotFoundException("Task dependency not found");
  }

  await recordAuditLog(context, {
    action: AuditActionEnum.DELETED,
    entityType: DomainEntityTypeEnum.TASK_DEPENDENCY,
    entityId: dependency._id.toString(),
  });

  return { dependency };
};

export const listTaskWatchersService = async (
  workspaceId: string,
  taskId: string
) => {
  await ensureTask(workspaceId, taskId);

  const watchers = await TaskWatcherModel.find({
    workspace: workspaceId,
    task: taskId,
    deletedAt: null,
  })
    .populate("user", "_id name email profilePicture")
    .sort({ createdAt: 1 })
    .lean();

  return { watchers };
};

export const addTaskWatcherService = async (
  context: RequestContext,
  taskId: string,
  userId: string,
  source: TaskWatcherSourceEnumType = TaskWatcherSourceEnum.MANUAL
) => {
  await ensureTask(context.workspaceId, taskId);
  const watcher = await upsertWatcher({
    workspaceId: context.workspaceId,
    taskId,
    userId,
    addedBy: context.userId,
    source,
  });

  await recordAuditLog(context, {
    action: AuditActionEnum.CREATED,
    entityType: DomainEntityTypeEnum.TASK_WATCHER,
    entityId: watcher._id.toString(),
    metadata: { taskId, userId, source },
  });

  return { watcher };
};

export const removeTaskWatcherService = async (
  context: RequestContext,
  taskId: string,
  userId: string
) => {
  const watcher = await TaskWatcherModel.findOneAndUpdate(
    {
      workspace: context.workspaceId,
      task: taskId,
      user: userId,
      deletedAt: null,
    },
    {
      $set: {
        deletedAt: new Date(),
        deletedBy: getObjectId(context.userId),
      },
    },
    { new: true }
  );

  if (!watcher) {
    throw new NotFoundException("Task watcher not found");
  }

  await recordAuditLog(context, {
    action: AuditActionEnum.DELETED,
    entityType: DomainEntityTypeEnum.TASK_WATCHER,
    entityId: watcher._id.toString(),
    metadata: { taskId, userId },
  });

  return { watcher };
};

export const updateTaskRecurrenceService = async (
  context: RequestContext,
  taskId: string,
  body: {
    enabled: boolean;
    frequency: TaskRecurrenceFrequencyEnumType;
    interval: number;
    endsAt?: string | null;
    maxOccurrences?: number | null;
  }
) => {
  const task = await ensureTask(context.workspaceId, taskId);

  task.recurrence = {
    enabled: body.enabled,
    frequency: body.frequency,
    interval: body.interval,
    endsAt: body.endsAt ? new Date(body.endsAt) : null,
    maxOccurrences: body.maxOccurrences ?? null,
    occurrenceIndex: task.recurrence?.occurrenceIndex || 1,
    seriesRoot: task.recurrence?.seriesRoot || task._id,
    previousOccurrence: task.recurrence?.previousOccurrence || null,
  };
  await task.save();

  await recordAuditLog(context, {
    action: AuditActionEnum.UPDATED,
    entityType: DomainEntityTypeEnum.TASK,
    entityId: taskId,
    after: { recurrence: task.recurrence },
    metadata: { scope: "recurrence" },
  });

  return { task };
};

export const clearTaskRecurrenceService = async (
  context: RequestContext,
  taskId: string
) => {
  const task = await ensureTask(context.workspaceId, taskId);
  task.recurrence = {
    enabled: false,
    frequency: null,
    interval: 1,
    endsAt: null,
    maxOccurrences: null,
    occurrenceIndex: task.recurrence?.occurrenceIndex || 1,
    seriesRoot: task.recurrence?.seriesRoot || null,
    previousOccurrence: task.recurrence?.previousOccurrence || null,
  };
  await task.save();

  await recordAuditLog(context, {
    action: AuditActionEnum.UPDATED,
    entityType: DomainEntityTypeEnum.TASK,
    entityId: taskId,
    metadata: { scope: "recurrence", action: "cleared" },
  });

  return { task };
};

export const deleteTaskService = async (
  workspaceId: string,
  taskId: string,
  userId?: string,
  context?: RequestContext
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  const storageKeys: string[] = [];
  let projectId: string | null = null;

  try {
    const task = await ensureTask(workspaceId, taskId, session);
    projectId = task.project.toString();
    const taskIds = await collectDescendantTaskIds(
      workspaceId,
      task._id.toString(),
      session
    );

    for (const id of taskIds) {
      storageKeys.push(
        ...(await softDeleteFilesForTarget({
          workspaceId,
          targetType: DomainEntityTypeEnum.TASK,
          targetId: id,
          deletedBy: userId,
          session,
          deletePhysical: false,
        }))
      );
    }

    await TaskDependencyModel.updateMany(
      {
        workspace: workspaceId,
        deletedAt: null,
        $or: [
          { predecessorTask: { $in: taskIds } },
          { successorTask: { $in: taskIds } },
        ],
      },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: userId ? getObjectId(userId) : null,
        },
      }
    ).session(session);

    await TaskWatcherModel.updateMany(
      {
        workspace: workspaceId,
        task: { $in: taskIds },
        deletedAt: null,
      },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: userId ? getObjectId(userId) : null,
        },
      }
    ).session(session);

    await detachTimeEntriesForTasks({
      workspaceId,
      taskIds,
      deletedBy: userId,
      session,
    });

    await TaskModel.deleteMany({
      workspace: workspaceId,
      _id: { $in: taskIds },
    }).session(session);

    await session.commitTransaction();
    await deleteStoredFiles(storageKeys);

    if (context && projectId) {
      await emitDomainEvent({
        type: DomainEventTypeEnum.TASK_DELETED,
        context,
        entityType: DomainEntityTypeEnum.TASK,
        entityId: taskId,
        target: {
          type: DomainEntityTypeEnum.TASK,
          id: taskId,
        },
        metadata: {
          projectId,
        },
        occurredAt: new Date(),
      });
    }

    return;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const cleanupAdvancedTaskRecordsForProject = async ({
  workspaceId,
  projectId,
  deletedBy,
  session,
}: {
  workspaceId: string;
  projectId: string;
  deletedBy?: string | null;
  session: ClientSession;
}) => {
  const tasks = await TaskModel.find({
    project: projectId,
    workspace: workspaceId,
  })
    .select("_id")
    .session(session);
  const taskIds = tasks.map((task) => task._id.toString());

  if (taskIds.length === 0) {
    return [];
  }

  await TaskDependencyModel.updateMany(
    {
      workspace: workspaceId,
      deletedAt: null,
      $or: [
        { predecessorTask: { $in: taskIds } },
        { successorTask: { $in: taskIds } },
      ],
    },
    {
      $set: {
        deletedAt: new Date(),
        deletedBy: deletedBy ? getObjectId(deletedBy) : null,
      },
    }
  ).session(session);

  await TaskWatcherModel.updateMany(
    {
      workspace: workspaceId,
      task: { $in: taskIds },
      deletedAt: null,
    },
    {
      $set: {
        deletedAt: new Date(),
        deletedBy: deletedBy ? getObjectId(deletedBy) : null,
      },
    }
  ).session(session);

  return taskIds;
};
