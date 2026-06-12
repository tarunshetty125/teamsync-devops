import mongoose from "mongoose";
import MilestoneModel from "../models/milestone.model";
import ProjectModel from "../models/project.model";
import TaskDependencyModel from "../models/task-dependency.model";
import TaskModel from "../models/task.model";
import {
  TimelineRange,
  timelineRangeToDays,
} from "../validation/timeline.validation";

type TimelineFilters = {
  range: TimelineRange;
  startDate?: string;
  endDate?: string;
  projectIds?: string[];
  assigneeIds?: string[];
  labelIds?: string[];
  statuses?: string[];
};

const getObjectIds = (ids?: string[]) =>
  ids?.map((id) => new mongoose.Types.ObjectId(id));

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

const getTimelineWindow = (filters: TimelineFilters) => {
  if (filters.startDate && filters.endDate) {
    return {
      timelineStartDate: startOfDay(new Date(filters.startDate)),
      timelineEndDate: endOfDay(new Date(filters.endDate)),
    };
  }

  const today = startOfDay(new Date());
  return {
    timelineStartDate: today,
    timelineEndDate: endOfDay(addDays(today, timelineRangeToDays(filters.range) - 1)),
  };
};

const maxDate = (left: Date, right: Date) =>
  left.getTime() > right.getTime() ? left : right;

const minDate = (left: Date, right: Date) =>
  left.getTime() < right.getTime() ? left : right;

export const getTimelineService = async (
  workspaceId: string,
  filters: TimelineFilters
) => {
  const { timelineStartDate, timelineEndDate } = getTimelineWindow(filters);
  const projectObjectIds = getObjectIds(filters.projectIds);

  const taskMatch: Record<string, unknown> = {
    workspace: new mongoose.Types.ObjectId(workspaceId),
    dueDate: { $ne: null, $gte: timelineStartDate },
    createdAt: { $lte: timelineEndDate },
  };

  if (projectObjectIds?.length) {
    taskMatch.project = { $in: projectObjectIds };
  }
  if (filters.assigneeIds?.length) {
    taskMatch.assignedTo = { $in: getObjectIds(filters.assigneeIds) };
  }
  if (filters.labelIds?.length) {
    taskMatch.labels = { $in: getObjectIds(filters.labelIds) };
  }
  if (filters.statuses?.length) {
    taskMatch.status = { $in: filters.statuses };
  }

  const milestoneDateWindow = {
    $or: [
      { dueDate: { $gte: timelineStartDate, $lte: timelineEndDate } },
      { startDate: { $gte: timelineStartDate, $lte: timelineEndDate } },
      {
        startDate: { $lte: timelineEndDate },
        dueDate: { $gte: timelineStartDate },
      },
    ],
  };
  const milestoneMatch: Record<string, unknown> = {
    workspace: new mongoose.Types.ObjectId(workspaceId),
    deletedAt: null,
    ...milestoneDateWindow,
  };

  if (projectObjectIds?.length) {
    milestoneMatch.project = { $in: projectObjectIds };
  }

  const [tasks, milestones] = await Promise.all([
    TaskModel.find(taskMatch)
      .select(
        "_id taskCode title project workspace status priority assignedTo dueDate createdAt updatedAt labels"
      )
      .sort({ project: 1, dueDate: 1, createdAt: 1 })
      .limit(1000)
      .populate("assignedTo", "_id name profilePicture")
      .populate({
        path: "labels",
        match: { deletedAt: null },
        select: "_id name color",
      })
      .lean(),
    MilestoneModel.find(milestoneMatch)
      .select(
        "_id workspace project name description status startDate dueDate completedAt createdAt updatedAt"
      )
      .sort({ dueDate: 1, startDate: 1, createdAt: 1 })
      .limit(200)
      .lean(),
  ]);

  const taskIds = tasks.map((task) => task._id);
  const taskIdSet = new Set(taskIds.map((id) => id.toString()));
  const projectIdSet = new Set<string>();

  for (const task of tasks) {
    projectIdSet.add(task.project.toString());
  }
  for (const milestone of milestones) {
    projectIdSet.add(milestone.project.toString());
  }

  const [projects, dependencies] = await Promise.all([
    ProjectModel.find({
      _id: { $in: Array.from(projectIdSet).map((id) => new mongoose.Types.ObjectId(id)) },
      workspace: workspaceId,
    })
      .select("_id name emoji description createdAt updatedAt")
      .sort({ name: 1 })
      .lean(),
    taskIds.length
      ? TaskDependencyModel.find({
          workspace: workspaceId,
          deletedAt: null,
          predecessorTask: { $in: taskIds },
          successorTask: { $in: taskIds },
        })
          .select("_id predecessorTask successorTask type")
          .lean()
      : Promise.resolve([]),
  ]);

  return {
    range: {
      startDate: timelineStartDate,
      endDate: timelineEndDate,
    },
    projects: projects.map((project) => ({
      _id: project._id.toString(),
      name: project.name,
      emoji: project.emoji,
      description: project.description || null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    })),
    tasks: tasks.map((task) => {
      const dueDate = task.dueDate as Date;
      const assignedTo = task.assignedTo as unknown as {
        _id: mongoose.Types.ObjectId;
        name: string;
        profilePicture?: string | null;
      } | null;
      const labels = task.labels as unknown as {
        _id: mongoose.Types.ObjectId;
        name: string;
        color: string;
      }[];

      return {
        _id: task._id.toString(),
        taskCode: task.taskCode,
        title: task.title,
        project: task.project.toString(),
        status: task.status,
        priority: task.priority,
        assignedTo:
          assignedTo && typeof assignedTo === "object"
            ? {
                _id: assignedTo._id.toString(),
                name: assignedTo.name,
                profilePicture: assignedTo.profilePicture || null,
              }
            : null,
        labels: Array.isArray(labels)
          ? labels.map((label) => ({
              _id: label._id.toString(),
              name: label.name,
              color: label.color,
            }))
          : [],
        createdAt: task.createdAt,
        dueDate,
        barStart: maxDate(task.createdAt, timelineStartDate),
        barEnd: minDate(dueDate, timelineEndDate),
        updatedAt: task.updatedAt,
      };
    }),
    milestones: milestones.map((milestone) => ({
      _id: milestone._id.toString(),
      workspace: milestone.workspace.toString(),
      project: milestone.project.toString(),
      name: milestone.name,
      description: milestone.description || null,
      status: milestone.status,
      startDate: milestone.startDate || null,
      dueDate: milestone.dueDate || null,
      completedAt: milestone.completedAt || null,
      createdAt: milestone.createdAt,
      updatedAt: milestone.updatedAt,
    })),
    dependencies: dependencies
      .filter(
        (dependency) =>
          taskIdSet.has(dependency.predecessorTask.toString()) &&
          taskIdSet.has(dependency.successorTask.toString())
      )
      .map((dependency) => ({
        _id: dependency._id.toString(),
        predecessorTask: dependency.predecessorTask.toString(),
        successorTask: dependency.successorTask.toString(),
        type: dependency.type,
      })),
  };
};
