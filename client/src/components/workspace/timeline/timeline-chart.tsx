import { Badge } from "@/components/ui/badge";
import { TaskStatusEnum } from "@/constant";
import { transformStatusEnum } from "@/lib/helper";
import {
  MilestoneType,
  TimelineDependencyType,
  TimelineProjectType,
  TimelineTaskType,
} from "@/types/api.type";
import DependencyRenderer from "./dependency-renderer";

const laneHeight = 136;
const laneHeaderWidth = 210;
const maxVisibleTasksPerProject = 3;
const toTime = (value: string | Date) => new Date(value).getTime();

const percentBetween = (value: string | Date, start: string, end: string) => {
  const startTime = toTime(start);
  const endTime = toTime(end);
  const valueTime = toTime(value);

  if (endTime <= startTime) return 0;
  return Math.max(
    0,
    Math.min(100, ((valueTime - startTime) / (endTime - startTime)) * 100)
  );
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
};

const getProjectLabel = (project: TimelineProjectType) =>
  `${project.emoji || ""} ${project.name}`.trim();

const statusBarClass = (status: string) => {
  switch (status) {
    case TaskStatusEnum.DONE:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case TaskStatusEnum.IN_REVIEW:
      return "border-violet-200 bg-violet-50 text-violet-700";
    case TaskStatusEnum.IN_PROGRESS:
      return "border-amber-200 bg-amber-50 text-amber-800";
    case TaskStatusEnum.TODO:
      return "border-sky-200 bg-sky-50 text-sky-700";
    case TaskStatusEnum.BACKLOG:
      return "border-slate-200 bg-slate-50 text-slate-600";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
};

const getVisibleWidth = (
  task: Pick<TimelineTaskType, "barStart" | "barEnd">,
  rangeStart: string,
  rangeEnd: string
) => {
  const left = percentBetween(task.barStart, rangeStart, rangeEnd);
  const right = percentBetween(task.barEnd, rangeStart, rangeEnd);
  return Math.max(0, right - left);
};

const pickOverviewTasks = (
  items: TimelineTaskType[],
  rangeStart: string,
  rangeEnd: string
) =>
  [...items]
    .map((task) => ({
      task,
      startTime: toTime(task.barStart || task.createdAt),
      visibleWidth: getVisibleWidth(task, rangeStart, rangeEnd),
    }))
    .sort(
      (left, right) =>
        right.visibleWidth - left.visibleWidth || left.startTime - right.startTime
    )
    .slice(0, maxVisibleTasksPerProject)
    .sort((left, right) => left.startTime - right.startTime)
    .map(({ task }) => task);

const getBarWidth = (left: number, right: number) => {
  const available = Math.max(1, 100 - left);
  return Math.min(Math.max(right - left, 7), available);
};

export default function TimelineChart({
  rangeStart,
  rangeEnd,
  projects,
  tasks,
  milestones,
  dependencies,
  onTaskClick,
  onMilestoneClick,
}: {
  rangeStart: string;
  rangeEnd: string;
  projects: TimelineProjectType[];
  tasks: TimelineTaskType[];
  milestones: MilestoneType[];
  dependencies: TimelineDependencyType[];
  onTaskClick: (task: TimelineTaskType) => void;
  onMilestoneClick: (milestone: MilestoneType) => void;
}) {
  const tasksByProject = new Map<string, TimelineTaskType[]>();
  const milestonesByProject = new Map<string, MilestoneType[]>();
  const taskPositions: Record<string, { x: number; y: number }> = {};

  for (const task of tasks) {
    const items = tasksByProject.get(task.project) || [];
    items.push(task);
    tasksByProject.set(task.project, items);
  }

  for (const milestone of milestones) {
    const items = milestonesByProject.get(milestone.project) || [];
    items.push(milestone);
    milestonesByProject.set(milestone.project, items);
  }

  const totalHeight = Math.max(projects.length * laneHeight, laneHeight);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="min-w-[900px]">
        <div className="flex border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase text-slate-500">
          <div
            className="shrink-0 border-r border-slate-200 px-4 py-3"
            style={{ width: laneHeaderWidth }}
          >
            Project
          </div>
          <div className="grid flex-1 grid-cols-4">
            {[0, 1, 2, 3].map((index) => {
              const start = toTime(rangeStart);
              const end = toTime(rangeEnd);
              const tick = new Date(start + ((end - start) / 3) * index);

              return (
                <div
                  key={index}
                  className="border-r border-slate-200 px-4 py-3 last:border-r-0"
                >
                  {formatShortDate(tick.toISOString())}
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative" style={{ height: totalHeight }}>
          <DependencyRenderer
            dependencies={dependencies}
            taskPositions={taskPositions}
          />
          {projects.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-slate-500">
              No timeline items match the current filters.
            </div>
          ) : (
            projects.map((project, projectIndex) => {
              const projectTasks = tasksByProject.get(project._id) || [];
              const visibleTasks = pickOverviewTasks(
                projectTasks,
                rangeStart,
                rangeEnd
              );
              const hiddenTaskCount = Math.max(
                0,
                projectTasks.length - visibleTasks.length
              );
              const projectMilestones =
                milestonesByProject.get(project._id) || [];
              const y = projectIndex * laneHeight;

              for (const task of visibleTasks) {
                const left = percentBetween(task.barStart, rangeStart, rangeEnd);
                const right = percentBetween(task.barEnd, rangeStart, rangeEnd);
                const width = getBarWidth(left, right);
                taskPositions[task._id] = {
                  x: left + width / 2,
                  y: y + 48,
                };
              }

              return (
                <div
                  key={project._id}
                  className="absolute left-0 right-0 flex border-b border-slate-100 last:border-b-0"
                  style={{ top: y, height: laneHeight }}
                >
                  <div
                    className="flex shrink-0 flex-col justify-center border-r border-slate-100 bg-white px-4"
                    style={{ width: laneHeaderWidth }}
                  >
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {getProjectLabel(project)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Showing {visibleTasks.length} of {projectTasks.length} task
                      {projectTasks.length === 1 ? "" : "s"} ·{" "}
                      {projectMilestones.length} milestone
                      {projectMilestones.length === 1 ? "" : "s"}
                    </p>
                    {hiddenTaskCount > 0 ? (
                      <p className="text-[11px] text-slate-400">
                        +{hiddenTaskCount} more in this range
                      </p>
                    ) : null}
                  </div>
                  <div className="relative flex-1">
                    <div className="absolute inset-0 grid grid-cols-4">
                      {[0, 1, 2, 3].map((line) => (
                        <div
                          key={line}
                          className="border-r border-slate-100 last:border-r-0"
                        />
                      ))}
                    </div>
                    {visibleTasks.map((task, taskIndex) => {
                      const left = percentBetween(
                        task.barStart,
                        rangeStart,
                        rangeEnd
                      );
                      const right = percentBetween(
                        task.barEnd,
                        rangeStart,
                        rangeEnd
                      );
                      const rawWidth = Math.max(0, right - left);
                      const width = getBarWidth(left, right);
                      const isCompact = rawWidth < 12;
                      const top = 18 + taskIndex * 28;

                      return (
                        <button
                          key={task._id}
                          type="button"
                          className={`absolute z-10 flex h-7 items-center overflow-hidden rounded-full border px-3 text-left text-[11px] font-semibold shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:shadow-md ${statusBarClass(task.status)}`}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            top,
                          }}
                          onClick={() => onTaskClick(task)}
                          title={`${task.taskCode} · ${task.title} (${formatShortDate(
                            task.createdAt
                          )} - ${formatShortDate(task.dueDate)})`}
                        >
                          <span className="flex min-w-0 items-center gap-1.5 truncate">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
                            <span className="truncate">
                              {isCompact
                                ? task.taskCode
                                : `${task.taskCode} · ${task.title}`}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                    {projectMilestones.map((milestone, milestoneIndex) => {
                      const markerDate = milestone.dueDate || milestone.startDate;
                      if (!markerDate) return null;
                      const left = percentBetween(
                        markerDate,
                        rangeStart,
                        rangeEnd
                      );

                      return (
                        <button
                          key={milestone._id}
                          type="button"
                          className="absolute z-20 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-[3px] border-2 border-amber-400 bg-white shadow-sm ring-4 ring-amber-50 transition-transform hover:scale-110"
                          style={{
                            left: `${left}%`,
                            top: 106 + (milestoneIndex % 2) * 16,
                          }}
                          onClick={() => onMilestoneClick(milestone)}
                          title={`${milestone.name} · ${formatShortDate(markerDate)}`}
                        >
                          <span className="sr-only">{milestone.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-500">
          {Object.values(TaskStatusEnum).map((status) => (
            <Badge key={status} variant={TaskStatusEnum[status]}>
              {transformStatusEnum(status)}
            </Badge>
          ))}
          <span className="ml-auto">
            Read-only overview. Milestones are outlined diamond markers.
          </span>
        </div>
      </div>
    </div>
  );
}
