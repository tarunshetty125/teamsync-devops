import mongoose from "mongoose";
import { Roles } from "../enums/role.enum";
import { TaskStatusEnum } from "../enums/task.enum";
import MemberModel from "../models/member.model";
import CommentModel from "../models/comment.model";
import FileAssetModel from "../models/file-asset.model";
import NotificationModel from "../models/notification.model";
import ProjectModel from "../models/project.model";
import TaskDependencyModel from "../models/task-dependency.model";
import TaskModel from "../models/task.model";
import TimeEntryModel from "../models/time-entry.model";
import { DashboardRange } from "../validation/dashboard.validation";
import { getCachedDashboardValue } from "./dashboard-cache.service";

type HealthStatus = "HEALTHY" | "AT_RISK" | "CRITICAL";

const rangeDays: Record<DashboardRange, number> = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
};

const openTaskQuery = { status: { $ne: TaskStatusEnum.DONE } };

const getObjectId = (id: string) => new mongoose.Types.ObjectId(id);

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

const round = (value: number) => Math.round(value * 100) / 100;

const percent = (part: number, total: number) =>
  total > 0 ? round((part / total) * 100) : 0;

const serverTimeZone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const healthStatusForScore = (score: number): HealthStatus => {
  if (score >= 75) return "HEALTHY";
  if (score >= 50) return "AT_RISK";
  return "CRITICAL";
};

const dayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getRangeWindow = (range: DashboardRange) => {
  const days = rangeDays[range];
  const now = new Date();
  const startDate = startOfDay(addDays(now, -(days - 1)));
  const endDate = endOfDay(now);
  const futureEndDate = endOfDay(addDays(now, days - 1));

  return {
    days,
    now,
    startDate,
    endDate,
    futureEndDate,
  };
};

const buildDailyBuckets = (
  startDate: Date,
  days: number,
  counts: Map<string, number>
) =>
  Array.from({ length: days }, (_, index) => {
    const date = addDays(startDate, index);
    const key = dayKey(date);

    return {
      date: key,
      count: counts.get(key) || 0,
    };
  });

const serializeTask = (task: Record<string, any>) => ({
  _id: task._id.toString(),
  taskCode: task.taskCode,
  title: task.title,
  status: task.status,
  priority: task.priority,
  dueDate: task.dueDate,
  completedAt: task.completedAt,
  updatedAt: task.updatedAt,
  project:
    task.project && typeof task.project === "object"
      ? {
          _id: task.project._id.toString(),
          name: task.project.name,
          emoji: task.project.emoji,
        }
      : null,
  assignedTo:
    task.assignedTo && typeof task.assignedTo === "object"
      ? {
          _id: task.assignedTo._id.toString(),
          name: task.assignedTo.name,
          profilePicture: task.assignedTo.profilePicture || null,
        }
      : null,
});

const getBlockedOpenTaskIdsByProject = async (workspaceId: string) => {
  const dependencies = await TaskDependencyModel.find({
    workspace: workspaceId,
    deletedAt: null,
  })
    .populate("predecessorTask", "_id status")
    .populate("successorTask", "_id status project workspace")
    .lean();

  const blockedByProject = new Map<string, Set<string>>();

  for (const dependency of dependencies) {
    const predecessor = dependency.predecessorTask as unknown as
      | { status?: string }
      | null;
    const successor = dependency.successorTask as unknown as
      | {
          _id: mongoose.Types.ObjectId;
          status?: string;
          project?: mongoose.Types.ObjectId;
          workspace?: mongoose.Types.ObjectId;
        }
      | null;

    if (
      !predecessor ||
      !successor ||
      predecessor.status === TaskStatusEnum.DONE ||
      successor.status === TaskStatusEnum.DONE ||
      successor.workspace?.toString() !== workspaceId ||
      !successor.project
    ) {
      continue;
    }

    const projectId = successor.project.toString();
    const taskIds = blockedByProject.get(projectId) || new Set<string>();
    taskIds.add(successor._id.toString());
    blockedByProject.set(projectId, taskIds);
  }

  return blockedByProject;
};

const getProjectHealthRows = async (workspaceId: string, limit = 20) => {
  const [projects, taskCounts, blockedByProject] = await Promise.all([
    ProjectModel.find({ workspace: workspaceId })
      .select("_id name emoji updatedAt createdAt")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean(),
    TaskModel.aggregate([
      { $match: { workspace: getObjectId(workspaceId) } },
      {
        $group: {
          _id: "$project",
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ["$status", TaskStatusEnum.DONE] }, 1, 0] },
          },
          openTasks: {
            $sum: { $cond: [{ $ne: ["$status", TaskStatusEnum.DONE] }, 1, 0] },
          },
          overdueOpenTasks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$status", TaskStatusEnum.DONE] },
                    { $ne: ["$dueDate", null] },
                    { $lt: ["$dueDate", new Date()] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    getBlockedOpenTaskIdsByProject(workspaceId),
  ]);

  const countsByProject = new Map(
    taskCounts.map((item) => [item._id.toString(), item])
  );

  return projects
    .map((project) => {
      const projectId = project._id.toString();
      const counts = countsByProject.get(projectId) || {
        totalTasks: 0,
        completedTasks: 0,
        openTasks: 0,
        overdueOpenTasks: 0,
      };
      const blockedOpenTasks = blockedByProject.get(projectId)?.size || 0;
      const completionRatio =
        counts.totalTasks > 0
          ? (counts.completedTasks / counts.totalTasks) * 100
          : 100;
      const overdueHealth =
        counts.openTasks > 0
          ? (1 - counts.overdueOpenTasks / counts.openTasks) * 100
          : 100;
      const blockedHealth =
        counts.openTasks > 0
          ? (1 - blockedOpenTasks / counts.openTasks) * 100
          : 100;
      const score = round(
        0.4 * completionRatio + 0.3 * overdueHealth + 0.3 * blockedHealth
      );

      return {
        projectId,
        name: project.name,
        emoji: project.emoji,
        totalTasks: counts.totalTasks,
        completedTasks: counts.completedTasks,
        openTasks: counts.openTasks,
        overdueOpenTasks: counts.overdueOpenTasks,
        blockedOpenTasks,
        completionRate: percent(counts.completedTasks, counts.totalTasks),
        health: {
          score,
          status: healthStatusForScore(score),
        },
      };
    })
    .sort((left, right) => left.health.score - right.health.score);
};

const getCompletionBuckets = async (workspaceId: string, range: DashboardRange) => {
  const { days, startDate, endDate } = getRangeWindow(range);
  const rows = await TaskModel.aggregate([
    {
      $match: {
        workspace: getObjectId(workspaceId),
        status: TaskStatusEnum.DONE,
        completedAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$completedAt",
            timezone: serverTimeZone,
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);
  const counts = new Map(rows.map((row) => [row._id as string, row.count]));

  return buildDailyBuckets(startDate, days, counts);
};

export const getPersonalDashboardService = async (
  workspaceId: string,
  userId: string,
  range: DashboardRange
) =>
  getCachedDashboardValue(
    `dashboard:${workspaceId}:${userId}:personal:${range}`,
    async () => {
      const { startDate, futureEndDate } = getRangeWindow(range);
      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      const assignedOpenQuery = {
        workspace: workspaceId,
        assignedTo: userId,
        ...openTaskQuery,
      };

      const [
        assignedOpenTasks,
        dueToday,
        overdue,
        upcoming,
        dueTodayTasks,
        overdueTasks,
        upcomingTasks,
        recentlyUpdatedTasks,
      ] = await Promise.all([
        TaskModel.countDocuments(assignedOpenQuery),
        TaskModel.countDocuments({
          ...assignedOpenQuery,
          dueDate: { $gte: todayStart, $lte: todayEnd },
        }),
        TaskModel.countDocuments({
          ...assignedOpenQuery,
          dueDate: { $lt: todayStart },
        }),
        TaskModel.countDocuments({
          ...assignedOpenQuery,
          dueDate: { $gt: todayEnd, $lte: futureEndDate },
        }),
        TaskModel.find({
          ...assignedOpenQuery,
          dueDate: { $gte: todayStart, $lte: todayEnd },
        })
          .sort({ dueDate: 1, priority: -1 })
          .limit(10)
          .populate("project", "_id name emoji")
          .populate("assignedTo", "_id name profilePicture")
          .lean(),
        TaskModel.find({
          ...assignedOpenQuery,
          dueDate: { $lt: todayStart },
        })
          .sort({ dueDate: 1 })
          .limit(10)
          .populate("project", "_id name emoji")
          .populate("assignedTo", "_id name profilePicture")
          .lean(),
        TaskModel.find({
          ...assignedOpenQuery,
          dueDate: { $gt: todayEnd, $lte: futureEndDate },
        })
          .sort({ dueDate: 1 })
          .limit(10)
          .populate("project", "_id name emoji")
          .populate("assignedTo", "_id name profilePicture")
          .lean(),
        TaskModel.find({
          workspace: workspaceId,
          assignedTo: userId,
          updatedAt: { $gte: startDate },
        })
          .sort({ updatedAt: -1 })
          .limit(10)
          .populate("project", "_id name emoji")
          .populate("assignedTo", "_id name profilePicture")
          .lean(),
      ]);

      return {
        range,
        summary: {
          assignedOpenTasks,
          dueToday,
          overdue,
          upcoming,
        },
        dueTodayTasks: dueTodayTasks.map(serializeTask),
        overdueTasks: overdueTasks.map(serializeTask),
        upcomingTasks: upcomingTasks.map(serializeTask),
        recentlyUpdatedTasks: recentlyUpdatedTasks.map(serializeTask),
      };
    }
  );

export const getTeamDashboardService = async (
  workspaceId: string,
  userId: string,
  range: DashboardRange
) =>
  getCachedDashboardValue(
    `dashboard:${workspaceId}:${userId}:team:${range}`,
    async () => {
      const [members, workloadRows, statusRows, totals, projectHealth] =
        await Promise.all([
          MemberModel.find({ workspaceId })
            .populate("userId", "_id name email profilePicture")
            .populate("role", "name")
            .limit(50)
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
          TaskModel.aggregate([
            { $match: { workspace: getObjectId(workspaceId) } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ]),
          TaskModel.aggregate([
            { $match: { workspace: getObjectId(workspaceId) } },
            {
              $group: {
                _id: null,
                totalTasks: { $sum: 1 },
                completedTasks: {
                  $sum: {
                    $cond: [{ $eq: ["$status", TaskStatusEnum.DONE] }, 1, 0],
                  },
                },
                openTasks: {
                  $sum: {
                    $cond: [{ $ne: ["$status", TaskStatusEnum.DONE] }, 1, 0],
                  },
                },
                unassignedOpenTasks: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $ne: ["$status", TaskStatusEnum.DONE] },
                          { $eq: ["$assignedTo", null] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ]),
          getProjectHealthRows(workspaceId, 20),
        ]);

      const workloadByUser = new Map(
        workloadRows.map((row) => [row._id.toString(), row.openTasks])
      );
      const statusDistribution = Object.values(TaskStatusEnum).map((status) => ({
        status,
        count: statusRows.find((row) => row._id === status)?.count || 0,
      }));
      const summary = totals[0] || {
        totalTasks: 0,
        completedTasks: 0,
        openTasks: 0,
        unassignedOpenTasks: 0,
      };

      return {
        range,
        summary: {
          ...summary,
          completionRate: percent(summary.completedTasks, summary.totalTasks),
        },
        workload: members.map((member) => {
          const user = member.userId as unknown as {
            _id: mongoose.Types.ObjectId;
            name: string;
            email: string;
            profilePicture?: string | null;
          };
          const role = member.role as unknown as { name?: string };

          return {
            memberId: member._id.toString(),
            userId: user._id.toString(),
            name: user.name,
            email: user.email,
            profilePicture: user.profilePicture || null,
            role: role.name || "MEMBER",
            openTasks: workloadByUser.get(user._id.toString()) || 0,
          };
        }),
        statusDistribution,
        projectProgress: projectHealth.map((project) => ({
          projectId: project.projectId,
          name: project.name,
          emoji: project.emoji,
          totalTasks: project.totalTasks,
          completedTasks: project.completedTasks,
          openTasks: project.openTasks,
          completionRate: project.completionRate,
        })),
      };
    }
  );

export const getExecutiveDashboardService = async (
  workspaceId: string,
  userId: string,
  range: DashboardRange
) =>
  getCachedDashboardValue(
    `dashboard:${workspaceId}:${userId}:executive:${range}`,
    async () => {
      const { days, startDate, endDate } = getRangeWindow(range);
      const [
        projectHealth,
        completionTrend,
        totals,
        memberCounts,
        projectCount,
        commentVolume,
        fileStats,
        notificationVolume,
        timeStats,
        activeTimerCount,
      ] = await Promise.all([
          getProjectHealthRows(workspaceId, 20),
          getCompletionBuckets(workspaceId, range),
          TaskModel.aggregate([
            { $match: { workspace: getObjectId(workspaceId) } },
            {
              $group: {
                _id: null,
                totalTasks: { $sum: 1 },
                completedTasks: {
                  $sum: {
                    $cond: [{ $eq: ["$status", TaskStatusEnum.DONE] }, 1, 0],
                  },
                },
                openTasks: {
                  $sum: {
                    $cond: [{ $ne: ["$status", TaskStatusEnum.DONE] }, 1, 0],
                  },
                },
                overdueOpenTasks: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $ne: ["$status", TaskStatusEnum.DONE] },
                          { $ne: ["$dueDate", null] },
                          { $lt: ["$dueDate", new Date()] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ]),
          MemberModel.aggregate([
            { $match: { workspaceId: getObjectId(workspaceId) } },
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
                capacityHoursPerWeek: { $sum: "$capacityHoursPerWeek" },
              },
            },
          ]),
          ProjectModel.countDocuments({ workspace: workspaceId }),
          CommentModel.countDocuments({
            workspace: workspaceId,
            deletedAt: null,
            createdAt: { $gte: startDate, $lte: endDate },
          }),
          FileAssetModel.aggregate([
            {
              $match: {
                workspace: getObjectId(workspaceId),
                deletedAt: null,
              },
            },
            {
              $group: {
                _id: null,
                fileCount: { $sum: 1 },
                storageUsedBytes: { $sum: "$sizeBytes" },
                uploadsInRange: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gte: ["$createdAt", startDate] },
                          { $lte: ["$createdAt", endDate] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ]),
          NotificationModel.countDocuments({
            workspace: workspaceId,
            deletedAt: null,
            createdAt: { $gte: startDate, $lte: endDate },
          }),
          TimeEntryModel.aggregate([
            {
              $match: {
                workspace: getObjectId(workspaceId),
                deletedAt: null,
                startedAt: { $gte: startDate, $lte: endDate },
              },
            },
            {
              $group: {
                _id: null,
                trackedSeconds: { $sum: "$durationSeconds" },
              },
            },
          ]),
          TimeEntryModel.countDocuments({
            workspace: workspaceId,
            deletedAt: null,
            endedAt: null,
          }),
        ]);
      const summary = totals[0] || {
        totalTasks: 0,
        completedTasks: 0,
        openTasks: 0,
        overdueOpenTasks: 0,
      };
      const completedInRange = completionTrend.reduce(
        (total, bucket) => total + bucket.count,
        0
      );
      const blockedOpenTasks = projectHealth.reduce(
        (total, project) => total + project.blockedOpenTasks,
        0
      );
      const activeMembers =
        memberCounts.find((item) => item._id === "ACTIVE")?.count || 0;
      const inactiveMembers =
        memberCounts.find((item) => item._id === "DEACTIVATED")?.count || 0;
      const totalMembers = memberCounts.reduce(
        (total, item) => total + item.count,
        0
      );
      const totalCapacityHoursPerWeek = memberCounts.reduce(
        (total, item) => total + (item.capacityHoursPerWeek || 0),
        0
      );
      const trackedSeconds = timeStats[0]?.trackedSeconds || 0;
      const capacitySeconds = totalCapacityHoursPerWeek * 3600 * (days / 7);
      const storage = fileStats[0] || {
        fileCount: 0,
        storageUsedBytes: 0,
        uploadsInRange: 0,
      };

      return {
        range,
        summary: {
          totalProjects: projectCount,
          totalMembers,
          totalTasks: summary.totalTasks,
          completedTasks: summary.completedTasks,
          openTasks: summary.openTasks,
          overdueOpenTasks: summary.overdueOpenTasks,
          blockedOpenTasks,
          completionRate: percent(summary.completedTasks, summary.totalTasks),
        },
        projectHealth,
        completionTrend,
        velocity: {
          completedInRange,
          averageCompletedPerDay: round(completedInRange / days),
          buckets: completionTrend,
        },
        productivity: {
          overdueOpenRate: percent(summary.overdueOpenTasks, summary.openTasks),
          blockedOpenRate: percent(blockedOpenTasks, summary.openTasks),
          averageCompletedPerDay: round(completedInRange / days),
        },
        workspaceHealth: {
          totalMembers,
          activeMembers,
          inactiveMembers,
          totalProjects: projectCount,
          totalTasks: summary.totalTasks,
          completedTasks: summary.completedTasks,
          completionRate: percent(summary.completedTasks, summary.totalTasks),
          collaboration: {
            commentVolume,
            fileUploads: storage.uploadsInRange,
            notificationVolume,
          },
          productivity: {
            trackedHours: round(trackedSeconds / 3600),
            activeTimers: activeTimerCount,
            trackedSeconds,
            capacitySeconds,
            capacityUtilizationPercent:
              capacitySeconds === 0
                ? 0
                : Math.round((trackedSeconds / capacitySeconds) * 100),
          },
          storage: {
            fileCount: storage.fileCount,
            storageUsedBytes: storage.storageUsedBytes,
          },
        },
      };
    }
  );

export const canViewExecutiveDashboard = (role: string) =>
  role === Roles.OWNER || role === Roles.ADMIN;
