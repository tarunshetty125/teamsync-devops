import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { Permissions, RoleType } from "../enums/role.enum";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { getMemberRoleInWorkspace } from "../services/member.service";
import {
  createManualTimeEntryService,
  deleteTimeEntryService,
  getActiveTimerService,
  getProductivityCapacityService,
  getProductivityWorkloadService,
  getTimesheetService,
  listTimeEntriesService,
  startTimerService,
  stopTimerService,
  updateMemberCapacityService,
  updateTimeEntryService,
} from "../services/time.service";
import { ForbiddenException, UnauthorizedException } from "../utils/appError";
import { buildRequestContext } from "../utils/request-context";
import { roleGuard } from "../utils/roleGuard";
import {
  createTimeEntrySchema,
  listTimeEntriesQuerySchema,
  memberIdSchema,
  productivityRangeQuerySchema,
  startTimerSchema,
  timeEntryIdSchema,
  timesheetQuerySchema,
  updateCapacitySchema,
  updateTimeEntrySchema,
} from "../validation/time.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";

const getAccess = async (userId: string | undefined, workspaceId: string) => {
  if (!userId) {
    throw new UnauthorizedException("Authenticated user context is required");
  }

  const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
  return { role: role as RoleType, userId };
};

const canViewTimesheets = (role: RoleType) => {
  try {
    roleGuard(role, [Permissions.VIEW_TIMESHEETS]);
    return true;
  } catch {
    return false;
  }
};

export const getActiveTimerController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id?.toString();
    const access = await getAccess(userId, workspaceId);
    roleGuard(access.role, [Permissions.TRACK_TIME]);

    const result = await getActiveTimerService(workspaceId, access.userId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Active timer retrieved successfully",
      ...result,
    });
  }
);

export const startTimerController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = startTimerSchema.parse(req.body);
    const access = await getAccess(req.user?._id?.toString(), workspaceId);
    roleGuard(access.role, [Permissions.TRACK_TIME]);

    const result = await startTimerService(
      buildRequestContext(req, workspaceId),
      body
    );

    if (result.conflict) {
      const activeTimer = result.activeTimer;

      return res.status(HTTPSTATUS.CONFLICT).json({
        message: "An active timer is already running",
        activeTimer,
        startedAt: activeTimer?.startedAt,
        taskId: activeTimer?.task || undefined,
        projectId: activeTimer?.project || undefined,
      });
    }

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Timer started successfully",
      activeTimer: result.activeTimer,
    });
  }
);

export const stopTimerController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const access = await getAccess(req.user?._id?.toString(), workspaceId);
    roleGuard(access.role, [Permissions.TRACK_TIME]);

    const result = await stopTimerService(buildRequestContext(req, workspaceId));

    return res.status(HTTPSTATUS.OK).json({
      message: "Timer stopped successfully",
      ...result,
    });
  }
);

export const createTimeEntryController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = createTimeEntrySchema.parse(req.body);
    const access = await getAccess(req.user?._id?.toString(), workspaceId);
    roleGuard(access.role, [Permissions.TRACK_TIME]);

    const result = await createManualTimeEntryService(
      buildRequestContext(req, workspaceId),
      body
    );

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Time entry created successfully",
      ...result,
    });
  }
);

export const listTimeEntriesController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const query = listTimeEntriesQuerySchema.parse(req.query);
    const access = await getAccess(req.user?._id?.toString(), workspaceId);
    roleGuard(access.role, [Permissions.TRACK_TIME]);

    const result = await listTimeEntriesService(workspaceId, access, query);

    return res.status(HTTPSTATUS.OK).json({
      message: "Time entries retrieved successfully",
      ...result,
    });
  }
);

export const updateTimeEntryController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const entryId = timeEntryIdSchema.parse(req.params.entryId);
    const body = updateTimeEntrySchema.parse(req.body);
    const access = await getAccess(req.user?._id?.toString(), workspaceId);
    roleGuard(access.role, [Permissions.TRACK_TIME]);

    const result = await updateTimeEntryService(
      buildRequestContext(req, workspaceId),
      access,
      entryId,
      body
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Time entry updated successfully",
      ...result,
    });
  }
);

export const deleteTimeEntryController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const entryId = timeEntryIdSchema.parse(req.params.entryId);
    const access = await getAccess(req.user?._id?.toString(), workspaceId);
    roleGuard(access.role, [Permissions.TRACK_TIME]);

    await deleteTimeEntryService(
      buildRequestContext(req, workspaceId),
      access,
      entryId
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Time entry deleted successfully",
    });
  }
);

export const getTimesheetController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const query = timesheetQuerySchema.parse(req.query);
    const access = await getAccess(req.user?._id?.toString(), workspaceId);

    if (query.userId && query.userId !== access.userId && !canViewTimesheets(access.role)) {
      throw new ForbiddenException("You cannot view another member's timesheet");
    }

    const result = await getTimesheetService(workspaceId, access, query);

    return res.status(HTTPSTATUS.OK).json({
      message: "Timesheet retrieved successfully",
      timesheet: result,
    });
  }
);

export const getWorkloadController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const { range } = productivityRangeQuerySchema.parse(req.query);
    const access = await getAccess(req.user?._id?.toString(), workspaceId);
    roleGuard(access.role, [Permissions.VIEW_TIMESHEETS]);

    const workload = await getProductivityWorkloadService(workspaceId, range);

    return res.status(HTTPSTATUS.OK).json({
      message: "Productivity workload retrieved successfully",
      workload,
    });
  }
);

export const getCapacityController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const { range } = productivityRangeQuerySchema.parse(req.query);
    const access = await getAccess(req.user?._id?.toString(), workspaceId);
    roleGuard(access.role, [Permissions.VIEW_TIMESHEETS]);

    const capacity = await getProductivityCapacityService(workspaceId, range);

    return res.status(HTTPSTATUS.OK).json({
      message: "Productivity capacity retrieved successfully",
      capacity,
    });
  }
);

export const updateCapacityController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const memberId = memberIdSchema.parse(req.params.memberId);
    const { capacityHoursPerWeek } = updateCapacitySchema.parse(req.body);
    const access = await getAccess(req.user?._id?.toString(), workspaceId);
    roleGuard(access.role, [Permissions.MANAGE_CAPACITY]);

    const capacity = await updateMemberCapacityService(
      buildRequestContext(req, workspaceId),
      memberId,
      capacityHoursPerWeek
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Member capacity updated successfully",
      capacity,
    });
  }
);
