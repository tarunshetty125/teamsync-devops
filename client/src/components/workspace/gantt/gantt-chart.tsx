import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TaskStatusEnum } from "@/constant";
import { cn } from "@/lib/utils";
import {
  GanttTaskType,
  MilestoneType,
  TimelineDependencyType,
  TimelineProjectType,
} from "@/types/api.type";
import DependencyRenderer from "../timeline/dependency-renderer";

const dayMs = 24 * 60 * 60 * 1000;
const laneHeight = 144;
const laneHeaderWidth = 220;
const maxVisibleTasksPerProject = 3;
type InteractionMode = "move" | "resize-start" | "resize-end";

type Interaction = {
  task: GanttTaskType;
  mode: InteractionMode;
  startX: number;
  originalStartDate: Date;
  originalEndDate: Date;
  pointerId: number;
};

const toTime = (value: string | Date) => new Date(value).getTime();

const toDateInput = (value: string | Date) =>
  new Date(value).toISOString().slice(0, 10);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

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

const getTotalDays = (rangeStart: string, rangeEnd: string) =>
  Math.max(1, Math.round((toTime(rangeEnd) - toTime(rangeStart)) / dayMs) + 1);

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
  task: Pick<GanttTaskType, "barStart" | "barEnd">,
  rangeStart: string,
  rangeEnd: string
) => {
  const left = percentBetween(task.barStart, rangeStart, rangeEnd);
  const right = percentBetween(task.barEnd, rangeStart, rangeEnd);
  return Math.max(0, right - left);
};

const pickOverviewTasks = (
  items: GanttTaskType[],
  rangeStart: string,
  rangeEnd: string
) =>
  [...items]
    .map((task) => ({
      task,
      startTime: toTime(task.barStart || task.startDate),
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

export default function GanttChart({
  rangeStart,
  rangeEnd,
  projects,
  tasks,
  milestones,
  dependencies,
  onTaskClick,
  onMilestoneClick,
  onScheduleChange,
  onScheduleEdit,
  canEditSchedule,
}: {
  rangeStart: string;
  rangeEnd: string;
  projects: TimelineProjectType[];
  tasks: GanttTaskType[];
  milestones: MilestoneType[];
  dependencies: TimelineDependencyType[];
  onTaskClick: (task: GanttTaskType) => void;
  onMilestoneClick: (milestone: MilestoneType) => void;
  onScheduleChange: (task: GanttTaskType, startDate: string, endDate: string) => void;
  onScheduleEdit: (task: GanttTaskType) => void;
  canEditSchedule: boolean;
}) {
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(true);
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [preview, setPreview] = useState<{
    taskId: string;
    startDate: string;
    endDate: string;
  } | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsDesktop(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, []);

  const displayTasks = useMemo(
    () =>
      tasks.map((task) =>
        preview?.taskId === task._id
          ? {
              ...task,
              startDate: preview.startDate,
              endDate: preview.endDate,
              dueDate: preview.endDate,
              barStart: preview.startDate,
              barEnd: preview.endDate,
            }
          : task
      ),
    [preview, tasks]
  );

  const tasksByProject = new Map<string, GanttTaskType[]>();
  const milestonesByProject = new Map<string, MilestoneType[]>();
  const taskPositions: Record<string, { x: number; y: number }> = {};

  for (const task of displayTasks) {
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
  const totalDays = getTotalDays(rangeStart, rangeEnd);
  const dayWidth = () =>
    (timelineRef.current?.getBoundingClientRect().width || totalDays) / totalDays;

  const calculateSchedule = (clientX: number) => {
    if (!interaction) return null;
    const deltaDays = Math.round((clientX - interaction.startX) / dayWidth());
    let startDate = interaction.originalStartDate;
    let endDate = interaction.originalEndDate;

    if (interaction.mode === "move") {
      startDate = addDays(interaction.originalStartDate, deltaDays);
      endDate = addDays(interaction.originalEndDate, deltaDays);
    } else if (interaction.mode === "resize-start") {
      startDate = addDays(interaction.originalStartDate, deltaDays);
      if (startDate > endDate) startDate = endDate;
    } else {
      endDate = addDays(interaction.originalEndDate, deltaDays);
      if (endDate < startDate) endDate = startDate;
    }

    return {
      deltaDays,
      startDate: toDateInput(startDate),
      endDate: toDateInput(endDate),
    };
  };

  const beginInteraction = (
    event: PointerEvent<HTMLElement>,
    task: GanttTaskType,
    mode: InteractionMode
  ) => {
    if (!canEditSchedule) {
      onTaskClick(task);
      return;
    }

    if (!isDesktop) {
      onScheduleEdit(task);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteraction({
      task,
      mode,
      startX: event.clientX,
      originalStartDate: new Date(task.startDate),
      originalEndDate: new Date(task.endDate),
      pointerId: event.pointerId,
    });
  };

  const updateInteraction = (event: PointerEvent<HTMLElement>) => {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    const schedule = calculateSchedule(event.clientX);
    if (!schedule) return;
    setPreview({
      taskId: interaction.task._id,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
    });
  };

  const finishInteraction = (event: PointerEvent<HTMLElement>) => {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    const schedule = calculateSchedule(event.clientX);
    const shouldOpenTask =
      interaction.mode === "move" && schedule && schedule.deltaDays === 0;

    setInteraction(null);
    setPreview(null);

    if (!schedule) return;
    if (shouldOpenTask) {
      onTaskClick(interaction.task);
      return;
    }

    onScheduleChange(interaction.task, schedule.startDate, schedule.endDate);
  };

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <div className="min-w-[960px]">
        <div className="flex border-b bg-muted/30 text-xs font-medium text-muted-foreground">
          <div className="shrink-0 border-r px-3 py-2" style={{ width: laneHeaderWidth }}>
            Project
          </div>
          <div ref={timelineRef} className="grid flex-1 grid-cols-4">
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

        <div
          className="relative"
          style={{ height: totalHeight }}
          onPointerMove={updateInteraction}
          onPointerUp={finishInteraction}
        >
          <DependencyRenderer dependencies={dependencies} taskPositions={taskPositions} />
          {projects.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              No scheduled tasks match the current filters.
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
              const projectMilestones = milestonesByProject.get(project._id) || [];
              const y = projectIndex * laneHeight;

              for (const task of visibleTasks) {
                const left = percentBetween(task.barStart, rangeStart, rangeEnd);
                const right = percentBetween(task.barEnd, rangeStart, rangeEnd);
                const width = getBarWidth(left, right);
                taskPositions[task._id] = {
                  x: left + width / 2,
                  y: y + 50,
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
                      Showing {visibleTasks.length} of {projectTasks.length} scheduled task
                      {projectTasks.length === 1 ? "" : "s"}
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
                      const left = percentBetween(task.barStart, rangeStart, rangeEnd);
                      const right = percentBetween(task.barEnd, rangeStart, rangeEnd);
                      const rawWidth = Math.max(0, right - left);
                      const width = getBarWidth(left, right);
                      const isCompact = rawWidth < 12;
                      const top = 18 + taskIndex * 32;
                      const hasWarnings = task.dependencyWarnings.length > 0;

                      return (
                        <div
                          key={task._id}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            "absolute z-10 flex h-7 items-center overflow-hidden rounded-md text-[11px] font-medium shadow-sm transition-opacity hover:opacity-90",
                            statusBarClass(task.status),
                            canEditSchedule ? "cursor-grab" : "cursor-pointer",
                            interaction?.task._id === task._id && "cursor-grabbing",
                            hasWarnings && "bg-amber-600 text-white"
                          )}
                          style={{ left: `${left}%`, width: `${width}%`, top }}
                          onPointerDown={(event) =>
                            beginInteraction(event, task, "move")
                          }
                          title={`${task.title} (${formatShortDate(
                            task.startDate
                          )} - ${formatShortDate(task.endDate)})`}
                        >
                          {isDesktop && canEditSchedule ? (
                            <span
                              className="h-full w-2 cursor-ew-resize rounded-l-md bg-black/15"
                              onPointerDown={(event) =>
                                beginInteraction(event, task, "resize-start")
                              }
                            />
                          ) : null}
                          <span className="min-w-0 flex-1 truncate px-2">
                            {isCompact
                              ? task.taskCode
                              : `${task.taskCode} · ${task.title}`}
                          </span>
                          {hasWarnings ? (
                            <AlertTriangle className="mr-1 h-3.5 w-3.5 shrink-0" />
                          ) : null}
                          {isDesktop && canEditSchedule ? (
                            <span
                              className="h-full w-2 cursor-ew-resize rounded-r-md bg-black/15"
                              onPointerDown={(event) =>
                                beginInteraction(event, task, "resize-end")
                              }
                            />
                          ) : null}
                        </div>
                      );
                    })}
                    {projectMilestones.map((milestone, milestoneIndex) => {
                      const markerDate = milestone.dueDate || milestone.startDate;
                      if (!markerDate) return null;
                      const left = percentBetween(markerDate, rangeStart, rangeEnd);

                      return (
                        <button
                          key={milestone._id}
                          type="button"
                          className="absolute z-20 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-[3px] bg-amber-500 shadow-sm ring-2 ring-background transition-transform hover:scale-110"
                          style={{
                            left: `${left}%`,
                            top: 108 + (milestoneIndex % 2) * 16,
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
        <div className="flex flex-wrap items-center gap-2 border-t p-3 text-xs text-muted-foreground">
          <Badge variant="secondary">Day scheduling</Badge>
          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Dependency warning
          </Badge>
          <span className="ml-auto">
            {canEditSchedule
              ? isDesktop
                ? "Drag or resize task bars."
                : "Tap a task to edit dates."
              : "View-only schedule."}
          </span>
        </div>
      </div>
    </div>
  );
}
