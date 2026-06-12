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
      return "bg-emerald-600 text-white";
    case TaskStatusEnum.IN_REVIEW:
      return "bg-violet-600 text-white";
    case TaskStatusEnum.IN_PROGRESS:
      return "bg-amber-500 text-amber-950";
    case TaskStatusEnum.TODO:
      return "bg-blue-600 text-white";
    case TaskStatusEnum.BACKLOG:
      return "bg-slate-500 text-white";
    default:
      return "bg-slate-700 text-white";
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
    <div className="overflow-x-auto rounded-lg border bg-background">
      <div className="min-w-[900px]">
        <div className="flex border-b bg-muted/30 text-xs font-medium text-muted-foreground">
          <div
            className="shrink-0 border-r px-3 py-2"
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
                <div key={index} className="border-r px-3 py-2 last:border-r-0">
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
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
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
                  className="absolute left-0 right-0 flex border-b last:border-b-0"
                  style={{ top: y, height: laneHeight }}
                >
                  <div
                    className="flex shrink-0 flex-col justify-center border-r px-3"
                    style={{ width: laneHeaderWidth }}
                  >
                    <p className="truncate text-sm font-medium">
                      {getProjectLabel(project)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Showing {visibleTasks.length} of {projectTasks.length} task
                      {projectTasks.length === 1 ? "" : "s"} ·{" "}
                      {projectMilestones.length} milestone
                      {projectMilestones.length === 1 ? "" : "s"}
                    </p>
                    {hiddenTaskCount > 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        +{hiddenTaskCount} more in this range
                      </p>
                    ) : null}
                  </div>
                  <div className="relative flex-1">
                    <div className="absolute inset-0 grid grid-cols-4">
                      {[0, 1, 2, 3].map((line) => (
                        <div key={line} className="border-r last:border-r-0" />
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
                          className={`absolute z-10 h-6 overflow-hidden rounded-md px-2 text-left text-[11px] font-medium shadow-sm transition-opacity hover:opacity-90 ${statusBarClass(task.status)}`}
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
                          <span className="block truncate">
                            {isCompact
                              ? task.taskCode
                              : `${task.taskCode} · ${task.title}`}
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
                          className="absolute z-20 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-[3px] bg-amber-500 shadow-sm ring-2 ring-background transition-transform hover:scale-110"
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
        <div className="flex flex-wrap gap-2 border-t p-3 text-xs text-muted-foreground">
          {Object.values(TaskStatusEnum).map((status) => (
            <Badge key={status} variant={TaskStatusEnum[status]}>
              {transformStatusEnum(status)}
            </Badge>
          ))}
          <span className="ml-auto">
            Milestones are diamond markers. Hover for names.
          </span>
        </div>
      </div>
    </div>
  );
}
