import mongoose, { ClientSession } from "mongoose";
import {
  ActivityTypeEnum,
  AuditActionEnum,
  DomainEntityTypeEnum,
  DomainEventTypeEnum,
  TimeEntrySourceEnum,
} from "../enums/domain.enum";
import { Permissions, RoleType } from "../enums/role.enum";
import { TaskStatusEnum } from "../enums/task.enum";
import MemberModel from "../models/member.model";
import ProjectModel from "../models/project.model";
import TaskModel from "../models/task.model";
import TimeEntryModel, { TimeEntryDocument } from "../models/time-entry.model";
import { RequestContext } from "../types/request-context";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "../utils/appError";
import { roleGuard } from "../utils/roleGuard";
import { recordActivity } from "./activity.service";
import { recordAuditLog } from "./audit-log.service";
import { emitDomainEvent } from "./domain-event.service";
import {
  ProductivityRange,
  productivityRangeDays,
} from "../validation/time.validation";

type TargetInput = {
  taskId?: string | null;
  projectId?: string | null;
};

type TargetSnapshot = {
  task: mongoose.Types.ObjectId | null;
  project: mongoose.Types.ObjectId | null;
  taskTitle: string | null;
  taskCode: string | null;
  projectName: string | null;
};

type TimeAccess = {
  role: RoleType;
  userId: string;
};

type DateWindowInput = {
  startDate?: string;
  endDate?: string;
};

type EntryListFilters = DateWindowInput & {
  userId?: string;
  projectId?: string;
  taskId?: string;
  pageNumber: number;
  pageSize: number;
};

type TimesheetFilters = DateWindowInput & {
  userId?: string;
};

const getObjectId = (id: string) => new mongoose.Types.ObjectId(id);

const toIsoOrNull = (value?: Date | null) => value?.toISOString() ?? null;

const diffSeconds = (startedAt: Date, endedAt: Date) =>
  Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getCurrentWeekWindow = () => {
  const today = startOfDay(new Date());
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const startDate = addDays(today, mondayOffset);

  return {
    startDate,
    endDate: endOfDay(addDays(startDate, 6)),
  };
};

const getDateWindow = (filters: DateWindowInput) => {
  if (filters.startDate && filters.endDate) {
    return {
      startDate: startOfDay(new Date(filters.startDate)),
      endDate: endOfDay(new Date(filters.endDate)),
    };
  }

  return getCurrentWeekWindow();
};

const getRangeWindow = (range: ProductivityRange) => {
  const days = productivityRangeDays[range];
  const endDate = endOfDay(new Date());

  return {
    days,
    startDate: startOfDay(addDays(endDate, -(days - 1))),
    endDate,
  };
};

const dayKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

const ensureWorkspaceUser = async (workspaceId: string, userId: string) => {
  const member = await MemberModel.exists({ workspaceId, userId });

  if (!member) {
    throw new BadRequestException("User is not a member of this workspace");
  }
};

const ensureTarget = async (
  workspaceId: string,
  input: TargetInput
): Promise<TargetSnapshot> => {
  if (input.taskId) {
    const task = await TaskModel.findOne({
      _id: input.taskId,
      workspace: workspaceId,
    })
      .select("_id title taskCode project")
      .lean();

    if (!task) {
      throw new NotFoundException("Task not found in this workspace");
    }

    const project = await ProjectModel.findOne({
      _id: task.project,
      workspace: workspaceId,
    })
      .select("_id name")
      .lean();

    if (!project) {
      throw new NotFoundException("Task project not found in this workspace");
    }

    return {
      task: task._id,
      project: project._id,
      taskTitle: task.title,
      taskCode: task.taskCode,
      projectName: project.name,
    };
  }

  if (input.projectId) {
    const project = await ProjectModel.findOne({
      _id: input.projectId,
      workspace: workspaceId,
    })
      .select("_id name")
      .lean();

    if (!project) {
      throw new NotFoundException("Project not found in this workspace");
    }

    return {
      task: null,
      project: project._id,
      taskTitle: null,
      taskCode: null,
      projectName: project.name,
    };
  }

  return {
    task: null,
    project: null,
    taskTitle: null,
    taskCode: null,
    projectName: null,
  };
};

const serializeUser = (user: unknown) => {
  if (!user || typeof user !== "object" || !("_id" in user)) {
    return null;
  }

  const populated = user as {
    _id: mongoose.Types.ObjectId;
    name?: string;
    email?: string;
    profilePicture?: string | null;
  };

  return {
    _id: populated._id.toString(),
    name: populated.name || "",
    email: populated.email || "",
    profilePicture: populated.profilePicture || null,
  };
};

const serializeTimeEntry = (
  entry: TimeEntryDocument | Record<string, any>,
  now = new Date()
) => {
  const startedAt = entry.startedAt as Date;
  const endedAt = (entry.endedAt as Date | null | undefined) || null;
  const currentDurationSeconds = endedAt
    ? entry.durationSeconds
    : diffSeconds(startedAt, now);

  return {
    _id: entry._id.toString(),
    workspace: entry.workspace.toString(),
    user:
      typeof entry.user === "object" && "_id" in entry.user
        ? serializeUser(entry.user)
        : entry.user.toString(),
    task: entry.task?.toString?.() ?? null,
    project: entry.project?.toString?.() ?? null,
    taskTitle: entry.taskTitle || null,
    taskCode: entry.taskCode || null,
    projectName: entry.projectName || null,
    startedAt: startedAt.toISOString(),
    endedAt: toIsoOrNull(endedAt),
    durationSeconds: entry.durationSeconds,
    currentDurationSeconds,
    note: entry.note || null,
    source: entry.source,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
};

const recordTimeAuditActivity = async ({
  context,
  entry,
  action,
  activityType,
  summary,
  before,
  after,
  session,
}: {
  context: RequestContext;
  entry: TimeEntryDocument;
  action: keyof typeof AuditActionEnum;
  activityType: keyof typeof ActivityTypeEnum;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  session: ClientSession;
}) => {
  await Promise.all([
    recordAuditLog(
      context,
      {
        action: AuditActionEnum[action],
        entityType: DomainEntityTypeEnum.TIME_ENTRY,
        entityId: entry._id.toString(),
        before,
        after,
      },
      session
    ),
    recordActivity(
      context,
      {
        type: ActivityTypeEnum[activityType],
        entityType: DomainEntityTypeEnum.TIME_ENTRY,
        entityId: entry._id.toString(),
        projectId: entry.project?.toString() || null,
        taskId: entry.task?.toString() || null,
        summary,
      },
      session
    ),
  ]);
};

const emitTimeEvent = async (
  type:
    | typeof DomainEventTypeEnum.TIME_ENTRY_CREATED
    | typeof DomainEventTypeEnum.TIME_ENTRY_UPDATED
    | typeof DomainEventTypeEnum.TIME_ENTRY_DELETED,
  context: RequestContext,
  entry: TimeEntryDocument
) => {
  await emitDomainEvent({
    type,
    context,
    entityType: DomainEntityTypeEnum.TIME_ENTRY,
    entityId: entry._id.toString(),
    target: {
      type: DomainEntityTypeEnum.TIME_ENTRY,
      id: entry._id.toString(),
    },
    metadata: {
      userId: entry.user.toString(),
      taskId: entry.task?.toString() || null,
      projectId: entry.project?.toString() || null,
      source: entry.source,
    },
    occurredAt: new Date(),
  });
};

const findActiveTimer = (workspaceId: string, userId: string) =>
  TimeEntryModel.findOne({
    workspace: workspaceId,
    user: userId,
    source: TimeEntrySourceEnum.TIMER,
    endedAt: null,
    deletedAt: null,
  });

export const getActiveTimerService = async (
  workspaceId: string,
  userId: string
) => {
  const activeTimer = await findActiveTimer(workspaceId, userId).lean();

  return {
    activeTimer: activeTimer ? serializeTimeEntry(activeTimer) : null,
  };
};

export const startTimerService = async (
  context: RequestContext,
  input: TargetInput & { note?: string | null }
) => {
  const existingTimer = await findActiveTimer(
    context.workspaceId,
    context.userId
  ).lean();

  if (existingTimer) {
    return {
      conflict: true as const,
      activeTimer: serializeTimeEntry(existingTimer),
    };
  }

  const target = await ensureTarget(context.workspaceId, input);
  const session = await mongoose.startSession();
  session.startTransaction();
  let entry: TimeEntryDocument;

  try {
    [entry] = await TimeEntryModel.create(
      [
        {
          workspace: context.workspaceId,
          user: context.userId,
          ...target,
          startedAt: new Date(),
          endedAt: null,
          durationSeconds: 0,
          note: input.note || null,
          source: TimeEntrySourceEnum.TIMER,
        },
      ],
      { session }
    );

    await recordTimeAuditActivity({
      context,
      entry,
      action: "CREATED",
      activityType: "TIMER_STARTED",
      summary: "Timer started",
      after: serializeTimeEntry(entry),
      session,
    });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      const activeTimer = await findActiveTimer(
        context.workspaceId,
        context.userId
      ).lean();

      return {
        conflict: true as const,
        activeTimer: activeTimer ? serializeTimeEntry(activeTimer) : null,
      };
    }

    throw error;
  } finally {
    session.endSession();
  }

  await emitTimeEvent(DomainEventTypeEnum.TIME_ENTRY_CREATED, context, entry!);

  return {
    conflict: false as const,
    activeTimer: serializeTimeEntry(entry!),
  };
};

export const stopTimerService = async (context: RequestContext) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let entry: TimeEntryDocument | null = null;
  let before: Record<string, unknown> | undefined;

  try {
    entry = await findActiveTimer(context.workspaceId, context.userId).session(
      session
    );

    if (!entry) {
      throw new NotFoundException("No active timer is running");
    }

    before = serializeTimeEntry(entry);
    entry.endedAt = new Date();
    entry.durationSeconds = diffSeconds(entry.startedAt, entry.endedAt);
    await entry.save({ session });

    await recordTimeAuditActivity({
      context,
      entry,
      action: "UPDATED",
      activityType: "TIMER_STOPPED",
      summary: "Timer stopped",
      before,
      after: serializeTimeEntry(entry),
      session,
    });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  await emitTimeEvent(DomainEventTypeEnum.TIME_ENTRY_UPDATED, context, entry!);

  return {
    timeEntry: serializeTimeEntry(entry!),
  };
};

export const createManualTimeEntryService = async (
  context: RequestContext,
  input: TargetInput & {
    startedAt: string;
    endedAt: string;
    note?: string | null;
  }
) => {
  const target = await ensureTarget(context.workspaceId, input);
  const session = await mongoose.startSession();
  session.startTransaction();
  let entry: TimeEntryDocument;

  try {
    const startedAt = new Date(input.startedAt);
    const endedAt = new Date(input.endedAt);

    [entry] = await TimeEntryModel.create(
      [
        {
          workspace: context.workspaceId,
          user: context.userId,
          ...target,
          startedAt,
          endedAt,
          durationSeconds: diffSeconds(startedAt, endedAt),
          note: input.note || null,
          source: TimeEntrySourceEnum.MANUAL,
        },
      ],
      { session }
    );

    await recordTimeAuditActivity({
      context,
      entry,
      action: "CREATED",
      activityType: "TIME_ENTRY_CREATED",
      summary: "Time entry created",
      after: serializeTimeEntry(entry),
      session,
    });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  await emitTimeEvent(DomainEventTypeEnum.TIME_ENTRY_CREATED, context, entry!);

  return {
    timeEntry: serializeTimeEntry(entry!),
  };
};

const assertEntryAccess = (
  entry: TimeEntryDocument,
  access: TimeAccess,
  permission: typeof Permissions.MANAGE_TIME_ENTRIES
) => {
  if (entry.user.toString() === access.userId) {
    return;
  }

  try {
    roleGuard(access.role, [permission]);
  } catch {
    throw new ForbiddenException("You cannot manage another member's time entry");
  }
};

export const listTimeEntriesService = async (
  workspaceId: string,
  access: TimeAccess,
  filters: EntryListFilters
) => {
  const { startDate, endDate } = getDateWindow(filters);
  const requestedUserId = filters.userId || access.userId;

  if (requestedUserId !== access.userId) {
    roleGuard(access.role, [Permissions.VIEW_TIMESHEETS]);
    await ensureWorkspaceUser(workspaceId, requestedUserId);
  }

  const query: Record<string, unknown> = {
    workspace: getObjectId(workspaceId),
    user: getObjectId(requestedUserId),
    deletedAt: null,
    startedAt: { $gte: startDate, $lte: endDate },
  };

  if (filters.projectId) query.project = getObjectId(filters.projectId);
  if (filters.taskId) query.task = getObjectId(filters.taskId);

  const skip = (filters.pageNumber - 1) * filters.pageSize;
  const [entries, totalCount] = await Promise.all([
    TimeEntryModel.find(query)
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(filters.pageSize)
      .populate("user", "_id name email profilePicture")
      .lean(),
    TimeEntryModel.countDocuments(query),
  ]);

  return {
    range: { startDate, endDate },
    timeEntries: entries.map((entry) => serializeTimeEntry(entry)),
    pagination: {
      totalCount,
      pageSize: filters.pageSize,
      pageNumber: filters.pageNumber,
      totalPages: Math.ceil(totalCount / filters.pageSize),
      skip,
      limit: filters.pageSize,
    },
  };
};

export const updateTimeEntryService = async (
  context: RequestContext,
  access: TimeAccess,
  entryId: string,
  input: TargetInput & {
    startedAt?: string;
    endedAt?: string;
    note?: string | null;
  }
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let entry: TimeEntryDocument | null = null;
  let before: Record<string, unknown> | undefined;

  try {
    entry = await TimeEntryModel.findOne({
      _id: entryId,
      workspace: context.workspaceId,
      deletedAt: null,
    }).session(session);

    if (!entry) {
      throw new NotFoundException("Time entry not found");
    }

    assertEntryAccess(entry, access, Permissions.MANAGE_TIME_ENTRIES);

    if (!entry.endedAt) {
      throw new BadRequestException("Stop active timer before editing this entry");
    }

    before = serializeTimeEntry(entry);

    if (input.startedAt && input.endedAt) {
      entry.startedAt = new Date(input.startedAt);
      entry.endedAt = new Date(input.endedAt);
      entry.durationSeconds = diffSeconds(entry.startedAt, entry.endedAt);
    }

    if (input.note !== undefined) {
      entry.note = input.note || null;
    }

    if (input.taskId !== undefined) {
      const target = await ensureTarget(context.workspaceId, input);
      entry.task = target.task;
      entry.project = target.project;
      entry.taskTitle = target.taskTitle;
      entry.taskCode = target.taskCode;
      entry.projectName = target.projectName;
    } else if (input.projectId !== undefined) {
      const target = await ensureTarget(context.workspaceId, input);
      entry.project = target.project;
      entry.projectName = target.projectName;

      if (!target.project) {
        entry.task = null;
        entry.taskTitle = null;
        entry.taskCode = null;
      }
    }

    await entry.save({ session });

    await recordTimeAuditActivity({
      context,
      entry,
      action: "UPDATED",
      activityType: "TIME_ENTRY_UPDATED",
      summary: "Time entry updated",
      before,
      after: serializeTimeEntry(entry),
      session,
    });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  await emitTimeEvent(DomainEventTypeEnum.TIME_ENTRY_UPDATED, context, entry!);

  return {
    timeEntry: serializeTimeEntry(entry!),
  };
};

export const deleteTimeEntryService = async (
  context: RequestContext,
  access: TimeAccess,
  entryId: string
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let entry: TimeEntryDocument | null = null;
  let before: Record<string, unknown> | undefined;

  try {
    entry = await TimeEntryModel.findOne({
      _id: entryId,
      workspace: context.workspaceId,
      deletedAt: null,
    }).session(session);

    if (!entry) {
      throw new NotFoundException("Time entry not found");
    }

    assertEntryAccess(entry, access, Permissions.MANAGE_TIME_ENTRIES);

    before = serializeTimeEntry(entry);

    if (!entry.endedAt) {
      entry.endedAt = new Date();
      entry.durationSeconds = diffSeconds(entry.startedAt, entry.endedAt);
    }

    entry.deletedAt = new Date();
    entry.deletedBy = getObjectId(context.userId);
    await entry.save({ session });

    await recordTimeAuditActivity({
      context,
      entry,
      action: "DELETED",
      activityType: "TIME_ENTRY_DELETED",
      summary: "Time entry deleted",
      before,
      after: serializeTimeEntry(entry),
      session,
    });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  await emitTimeEvent(DomainEventTypeEnum.TIME_ENTRY_DELETED, context, entry!);
};

const getTrackedSecondsByUser = async (
  workspaceId: string,
  startDate: Date,
  endDate: Date
) => {
  const rows = await TimeEntryModel.aggregate([
    {
      $match: {
        workspace: getObjectId(workspaceId),
        deletedAt: null,
        startedAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$user",
        stoppedSeconds: {
          $sum: {
            $cond: [{ $ne: ["$endedAt", null] }, "$durationSeconds", 0],
          },
        },
        activeStartedAt: {
          $min: {
            $cond: [{ $eq: ["$endedAt", null] }, "$startedAt", null],
          },
        },
      },
    },
  ]);
  const now = new Date();

  return new Map(
    rows.map((row) => {
      const activeSeconds = row.activeStartedAt
        ? diffSeconds(new Date(row.activeStartedAt), now)
        : 0;

      return [row._id.toString(), row.stoppedSeconds + activeSeconds];
    })
  );
};

export const getTimesheetService = async (
  workspaceId: string,
  access: TimeAccess,
  filters: TimesheetFilters
) => {
  const { startDate, endDate } = getDateWindow(filters);
  const canViewAll = (() => {
    try {
      roleGuard(access.role, [Permissions.VIEW_TIMESHEETS]);
      return true;
    } catch {
      return false;
    }
  })();
  const requestedUserId = filters.userId || (canViewAll ? undefined : access.userId);

  if (requestedUserId && requestedUserId !== access.userId) {
    roleGuard(access.role, [Permissions.VIEW_TIMESHEETS]);
    await ensureWorkspaceUser(workspaceId, requestedUserId);
  }

  const query: Record<string, unknown> = {
    workspace: getObjectId(workspaceId),
    deletedAt: null,
    startedAt: { $gte: startDate, $lte: endDate },
  };

  if (requestedUserId) {
    query.user = getObjectId(requestedUserId);
  }

  const entries = await TimeEntryModel.find(query)
    .sort({ startedAt: 1 })
    .populate("user", "_id name email profilePicture")
    .lean();
  const dayMap = new Map<string, { date: string; totalSeconds: number; entries: any[] }>();
  const userMap = new Map<
    string,
    {
      userId: string;
      name: string;
      email: string;
      profilePicture: string | null;
      totalSeconds: number;
    }
  >();
  let totalSeconds = 0;

  for (const entry of entries) {
    const serialized = serializeTimeEntry(entry);
    const seconds = serialized.currentDurationSeconds;
    const date = dayKey(new Date(serialized.startedAt));
    const day = dayMap.get(date) || { date, totalSeconds: 0, entries: [] };
    day.totalSeconds += seconds;
    day.entries.push(serialized);
    dayMap.set(date, day);
    totalSeconds += seconds;

    if (serialized.user && typeof serialized.user === "object") {
      const current = userMap.get(serialized.user._id) || {
        userId: serialized.user._id,
        name: serialized.user.name,
        email: serialized.user.email,
        profilePicture: serialized.user.profilePicture,
        totalSeconds: 0,
      };
      current.totalSeconds += seconds;
      userMap.set(serialized.user._id, current);
    }
  }

  return {
    range: { startDate, endDate },
    totalSeconds,
    days: Array.from(dayMap.values()),
    users: Array.from(userMap.values()).sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
  };
};

export const getProductivityWorkloadService = async (
  workspaceId: string,
  range: ProductivityRange
) => {
  const { days, startDate, endDate } = getRangeWindow(range);
  const [members, openTaskRows, trackedSecondsByUser] = await Promise.all([
    MemberModel.find({ workspaceId })
      .populate("userId", "_id name email profilePicture")
      .populate("role", "name")
      .lean(),
    TaskModel.aggregate([
      {
        $match: {
          workspace: getObjectId(workspaceId),
          status: { $ne: TaskStatusEnum.DONE },
          assignedTo: { $ne: null },
        },
      },
      { $group: { _id: "$assignedTo", openTasks: { $sum: 1 } } },
    ]),
    getTrackedSecondsByUser(workspaceId, startDate, endDate),
  ]);
  const openTasksByUser = new Map(
    openTaskRows.map((row) => [row._id.toString(), row.openTasks])
  );

  return {
    range,
    rangeDays: days,
    startDate,
    endDate,
    members: members.map((member) => {
      const user = member.userId as unknown as {
        _id: mongoose.Types.ObjectId;
        name: string;
        email: string;
        profilePicture?: string | null;
      };
      const userId = user._id.toString();

      return {
        memberId: member._id.toString(),
        userId,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture || null,
        role: (member.role as unknown as { name?: string })?.name || "MEMBER",
        openTasks: openTasksByUser.get(userId) || 0,
        trackedSeconds: trackedSecondsByUser.get(userId) || 0,
      };
    }),
  };
};

export const getProductivityCapacityService = async (
  workspaceId: string,
  range: ProductivityRange
) => {
  const { days, startDate, endDate } = getRangeWindow(range);
  const [members, trackedSecondsByUser] = await Promise.all([
    MemberModel.find({ workspaceId })
      .populate("userId", "_id name email profilePicture")
      .populate("role", "name")
      .lean(),
    getTrackedSecondsByUser(workspaceId, startDate, endDate),
  ]);

  return {
    range,
    rangeDays: days,
    startDate,
    endDate,
    members: members.map((member) => {
      const user = member.userId as unknown as {
        _id: mongoose.Types.ObjectId;
        name: string;
        email: string;
        profilePicture?: string | null;
      };
      const userId = user._id.toString();
      const capacityHoursPerWeek = member.capacityHoursPerWeek ?? 40;
      const trackedSeconds = trackedSecondsByUser.get(userId) || 0;
      const capacitySeconds = capacityHoursPerWeek * 3600 * (days / 7);

      return {
        memberId: member._id.toString(),
        userId,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture || null,
        role: (member.role as unknown as { name?: string })?.name || "MEMBER",
        capacityHoursPerWeek,
        trackedSeconds,
        capacitySeconds,
        utilizationPercent:
          capacitySeconds === 0
            ? 0
            : Math.round((trackedSeconds / capacitySeconds) * 100),
      };
    }),
  };
};

export const updateMemberCapacityService = async (
  context: RequestContext,
  memberId: string,
  capacityHoursPerWeek: number
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let member: any;

  try {
    member = await MemberModel.findOne({
      _id: memberId,
      workspaceId: context.workspaceId,
    }).session(session);

    if (!member) {
      throw new NotFoundException("Workspace member not found");
    }

    const before = { capacityHoursPerWeek: member.capacityHoursPerWeek ?? 40 };
    member.capacityHoursPerWeek = capacityHoursPerWeek;
    await member.save({ session });

    await Promise.all([
      recordAuditLog(
        context,
        {
          action: AuditActionEnum.UPDATED,
          entityType: DomainEntityTypeEnum.MEMBER,
          entityId: member._id.toString(),
          before,
          after: { capacityHoursPerWeek },
          metadata: { scope: "capacity" },
        },
        session
      ),
      recordActivity(
        context,
        {
          type: ActivityTypeEnum.CAPACITY_UPDATED,
          entityType: DomainEntityTypeEnum.MEMBER,
          entityId: member._id.toString(),
          summary: "Member capacity updated",
          metadata: { before, after: { capacityHoursPerWeek } },
        },
        session
      ),
    ]);

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  return {
    memberId: member._id.toString(),
    capacityHoursPerWeek: member.capacityHoursPerWeek,
  };
};

const stopActiveEntries = async (
  match: Record<string, unknown>,
  session: ClientSession
) => {
  const activeEntries = await TimeEntryModel.find({
    ...match,
    deletedAt: null,
    endedAt: null,
  }).session(session);
  const now = new Date();

  for (const entry of activeEntries) {
    entry.endedAt = now;
    entry.durationSeconds = diffSeconds(entry.startedAt, now);
    await entry.save({ session });
  }
};

export const detachTimeEntriesForTasks = async ({
  workspaceId,
  taskIds,
  session,
}: {
  workspaceId: string;
  taskIds: Array<mongoose.Types.ObjectId | string>;
  deletedBy?: string;
  session: ClientSession;
}) => {
  if (taskIds.length === 0) return;

  await stopActiveEntries(
    {
      workspace: workspaceId,
      task: { $in: taskIds },
    },
    session
  );

  await TimeEntryModel.updateMany(
    {
      workspace: workspaceId,
      task: { $in: taskIds },
    },
    {
      $set: {
        task: null,
      },
    }
  ).session(session);
};

export const detachTimeEntriesForProject = async ({
  workspaceId,
  projectId,
  taskIds,
  session,
}: {
  workspaceId: string;
  projectId: string;
  taskIds: Array<mongoose.Types.ObjectId | string>;
  deletedBy?: string;
  session: ClientSession;
}) => {
  await stopActiveEntries(
    {
      workspace: workspaceId,
      $or: [{ project: projectId }, { task: { $in: taskIds } }],
    },
    session
  );

  await TimeEntryModel.updateMany(
    {
      workspace: workspaceId,
      $or: [{ project: projectId }, { task: { $in: taskIds } }],
    },
    {
      $set: {
        task: null,
        project: null,
      },
    }
  ).session(session);
};
