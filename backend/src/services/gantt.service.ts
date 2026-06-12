import mongoose from "mongoose";
import { TaskStatusEnum } from "../enums/task.enum";
import MilestoneModel from "../models/milestone.model";
import ProjectModel from "../models/project.model";
import TaskDependencyModel from "../models/task-dependency.model";
import TaskModel from "../models/task.model";
import { GanttFilters, ganttRangeToDays } from "../validation/gantt.validation";

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

const maxDate = (left: Date, right: Date) =>
  left.getTime() > right.getTime() ? left : right;

const minDate = (left: Date, right: Date) =>
  left.getTime() < right.getTime() ? left : right;

const getGanttWindow = (filters: GanttFilters) => {
  if (filters.startDate && filters.endDate) {
    return {
      ganttStartDate: startOfDay(new Date(filters.startDate)),
      ganttEndDate: endOfDay(new Date(filters.endDate)),
    };
  }

  const today = startOfDay(new Date());
  return {
    ganttStartDate: today,
    ganttEndDate: endOfDay(addDays(today, ganttRangeToDays(filters.range) - 1)),
  };
};

type LeanTask = {
  _id: mongoose.Types.ObjectId;
  taskCode: string;
  title: string;
  project: mongoose.Types.ObjectId;
  status: string;
  priority: string;
  assignedTo?: {
    _id: mongoose.Types.ObjectId;
    name: string;
    profilePicture?: string | null;
  } | null;
  labels?: {
    _id: mongoose.Types.ObjectId;
    name: string;
    color: string;
  }[];
  startDate: Date;
  endDate: Date;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

type PopulatedDependencyTask = {
  _id: mongoose.Types.ObjectId;
  title: string;
  taskCode: string;
  status: string;
  startDate?: Date | null;
  endDate?: Date | null;
  dueDate?: Date | null;
};

const getTaskEndDate = (task?: PopulatedDependencyTask | null) =>
  task?.endDate || task?.dueDate || null;

export const getGanttService = async (
  workspaceId: string,
  filters: GanttFilters
) => {
  const { ganttStartDate, ganttEndDate } = getGanttWindow(filters);
  const projectObjectIds = getObjectIds(filters.projectIds);

  const taskMatch: Record<string, unknown> = {
    workspace: new mongoose.Types.ObjectId(workspaceId),
    startDate: { $ne: null, $lte: ganttEndDate },
    endDate: { $ne: null, $gte: ganttStartDate },
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
      { dueDate: { $gte: ganttStartDate, $lte: ganttEndDate } },
      { startDate: { $gte: ganttStartDate, $lte: ganttEndDate } },
      {
        startDate: { $lte: ganttEndDate },
        dueDate: { $gte: ganttStartDate },
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
        "_id taskCode title project workspace status priority assignedTo startDate endDate dueDate createdAt updatedAt labels"
      )
      .sort({ project: 1, startDate: 1, endDate: 1, createdAt: 1 })
      .limit(1000)
      .populate("assignedTo", "_id name profilePicture")
      .populate({
        path: "labels",
        match: { deletedAt: null },
        select: "_id name color",
      })
      .lean<LeanTask[]>(),
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
      _id: {
        $in: Array.from(projectIdSet).map(
          (id) => new mongoose.Types.ObjectId(id)
        ),
      },
      workspace: workspaceId,
    })
      .select("_id name emoji description createdAt updatedAt")
      .sort({ name: 1 })
      .lean(),
    taskIds.length
      ? TaskDependencyModel.find({
          workspace: workspaceId,
          deletedAt: null,
          $or: [
            { predecessorTask: { $in: taskIds } },
            { successorTask: { $in: taskIds } },
          ],
        })
          .select("_id predecessorTask successorTask type")
          .populate(
            "predecessorTask",
            "_id title taskCode status startDate endDate dueDate"
          )
          .populate(
            "successorTask",
            "_id title taskCode status startDate endDate dueDate"
          )
          .lean()
      : Promise.resolve([]),
  ]);

  const dependencyWarnings = new Map<string, unknown[]>();
  const blockedByCount = new Map<string, number>();
  const isBlocked = new Map<string, boolean>();

  for (const taskId of taskIdSet) {
    dependencyWarnings.set(taskId, []);
    blockedByCount.set(taskId, 0);
    isBlocked.set(taskId, false);
  }

  for (const dependency of dependencies) {
    const predecessor = dependency.predecessorTask as unknown as
      | PopulatedDependencyTask
      | null;
    const successor = dependency.successorTask as unknown as
      | PopulatedDependencyTask
      | null;
    const successorId = successor?._id?.toString();

    if (!successorId || !taskIdSet.has(successorId)) {
      continue;
    }

    blockedByCount.set(successorId, (blockedByCount.get(successorId) || 0) + 1);
    if (predecessor?.status !== TaskStatusEnum.DONE) {
      isBlocked.set(successorId, true);
    }

    const predecessorEndDate = getTaskEndDate(predecessor);
    const successorStartDate = successor?.startDate || null;
    if (
      predecessorEndDate &&
      successorStartDate &&
      predecessorEndDate > successorStartDate
    ) {
      dependencyWarnings.get(successorId)!.push({
        dependencyId: dependency._id.toString(),
        predecessorTask: predecessor?._id.toString() || null,
        predecessorTitle: predecessor?.title || "Dependency",
        predecessorEndDate,
        successorStartDate,
        message:
          "Predecessor is scheduled to finish after this task starts",
      });
    }
  }

  return {
    range: {
      startDate: ganttStartDate,
      endDate: ganttEndDate,
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
      const taskId = task._id.toString();
      return {
        _id: taskId,
        taskCode: task.taskCode,
        title: task.title,
        project: task.project.toString(),
        status: task.status,
        priority: task.priority,
        assignedTo:
          task.assignedTo && typeof task.assignedTo === "object"
            ? {
                _id: task.assignedTo._id.toString(),
                name: task.assignedTo.name,
                profilePicture: task.assignedTo.profilePicture || null,
              }
            : null,
        labels: Array.isArray(task.labels)
          ? task.labels.map((label) => ({
              _id: label._id.toString(),
              name: label.name,
              color: label.color,
            }))
          : [],
        startDate: task.startDate,
        endDate: task.endDate,
        dueDate: task.dueDate,
        barStart: maxDate(task.startDate, ganttStartDate),
        barEnd: minDate(task.endDate, ganttEndDate),
        isBlocked: isBlocked.get(taskId) || false,
        blockedByCount: blockedByCount.get(taskId) || 0,
        dependencyWarnings: dependencyWarnings.get(taskId) || [],
        createdAt: task.createdAt,
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
      .filter((dependency) => {
        const predecessor = dependency.predecessorTask as unknown as
          | PopulatedDependencyTask
          | null;
        const successor = dependency.successorTask as unknown as
          | PopulatedDependencyTask
          | null;
        return (
          predecessor?._id &&
          successor?._id &&
          taskIdSet.has(predecessor._id.toString()) &&
          taskIdSet.has(successor._id.toString())
        );
      })
      .map((dependency) => {
        const predecessor = dependency.predecessorTask as unknown as
          | PopulatedDependencyTask
          | null;
        const successor = dependency.successorTask as unknown as
          | PopulatedDependencyTask
          | null;
        return {
          _id: dependency._id.toString(),
          predecessorTask: predecessor!._id.toString(),
          successorTask: successor!._id.toString(),
          type: dependency.type,
        };
      }),
  };
};
