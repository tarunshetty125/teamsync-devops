import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import useWorkspaceId from "@/hooks/use-workspace-id";
import { getAllTasksQueryFn } from "@/lib/api";
import { TaskType } from "@/types/api.type";
import { getAvatarColor, getAvatarFallbackText } from "@/lib/helper";

// ─── helpers ──────────────────────────────────────────────
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function statusColor(status: string) {
  switch (status) {
    case "DONE":
      return "bg-green-500/20 text-green-400 border-green-500/40";
    case "IN_PROGRESS":
      return "bg-blue-500/20 text-blue-400 border-blue-500/40";
    case "IN_REVIEW":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/40";
    case "TODO":
      return "bg-gray-500/20 text-gray-400 border-gray-500/40";
    case "BACKLOG":
      return "bg-gray-500/20 text-gray-500 border-gray-500/40";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/40";
  }
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function priorityBadge(priority: string) {
  switch (priority) {
    case "HIGH":
      return "bg-red-500/20 text-red-400 border-red-500/40";
    case "MEDIUM":
      return "bg-orange-500/20 text-orange-400 border-orange-500/40";
    case "LOW":
      return "bg-green-500/20 text-green-400 border-green-500/40";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/40";
  }
}

function formatDate(d: Date) {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function buildCalendarCells(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      inMonth: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }

  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({
      date: new Date(year, month + 1, d),
      inMonth: false,
    });
  }

  return cells;
}

// ─── component ────────────────────────────────────────────
const CalendarView = () => {
  const workspaceId = useWorkspaceId();
  const today = new Date();

  const [currentDate, setCurrentDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);

  // ─ calendar grid ─
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarCells = buildCalendarCells(year, month);

  const visibleStart = new Date(calendarCells[0].date);
  visibleStart.setHours(0, 0, 0, 0);

  const visibleEnd = new Date(calendarCells[calendarCells.length - 1].date);
  visibleEnd.setHours(23, 59, 59, 999);

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "all-tasks",
      workspaceId,
      "calendar",
      visibleStart.toISOString(),
      visibleEnd.toISOString(),
    ],
    queryFn: () =>
      getAllTasksQueryFn({
        workspaceId,
        dueDateFrom: visibleStart.toISOString(),
        dueDateTo: visibleEnd.toISOString(),
        pageNumber: 1,
        pageSize: 100,
      }),
    enabled: Boolean(workspaceId),
    staleTime: 0,
  });

  const tasks: TaskType[] = data?.tasks ?? [];

  const tasksByDate: Record<string, TaskType[]> = {};
  tasks.forEach((task) => {
    if (!task.dueDate) return;
    const dueDate = new Date(task.dueDate);
    const key = `${dueDate.getFullYear()}-${dueDate.getMonth()}-${dueDate.getDate()}`;
    (tasksByDate[key] ??= []).push(task);
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const upcomingTasks = tasks
    .filter((task) => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate >= todayStart && task.status !== "DONE";
    })
    .sort(
      (a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );

  const getTasksForDate = (d: Date) => {
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return tasksByDate[key] || [];
  };

  const selectedTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  // ─── navigation ─────────────────────────
  const prevMonth = () =>
    setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () =>
    setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };

  // ─── render ─────────────────────────────
  return (
    <div className="w-full space-y-6">
      {/* ── Calendar Section ── */}
      <div className="rounded-xl border border-border bg-card">
        {/* header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold">
              {MONTHS[month]} {year}
            </h3>
            <Button variant="outline" size="sm" onClick={goToday}>
              Today
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* day labels */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase"
            >
              {d}
            </div>
          ))}
        </div>

        {/* cells */}
        {isLoading ? (
          <div className="h-96 flex items-center justify-center text-muted-foreground">
            Loading tasks…
          </div>
        ) : isError ? (
          <div className="h-96 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm">Unable to load calendar tasks.</p>
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {calendarCells.map((cell, idx) => {
              const cellTasks = getTasksForDate(cell.date);
              const isToday = isSameDay(cell.date, today);
              const isSelected =
                selectedDate && isSameDay(cell.date, selectedDate);

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(cell.date)}
                  className={`
                    relative min-h-[90px] p-1.5 border-b border-r border-border text-left
                    transition-colors hover:bg-accent/50
                    ${!cell.inMonth ? "bg-muted/30" : ""}
                    ${isSelected ? "bg-accent ring-2 ring-primary ring-inset" : ""}
                  `}
                >
                  <span
                    className={`
                      inline-flex items-center justify-center w-7 h-7 text-xs font-medium rounded-full
                      ${!cell.inMonth ? "text-muted-foreground/50" : ""}
                      ${isToday ? "bg-primary text-primary-foreground" : ""}
                    `}
                  >
                    {cell.date.getDate()}
                  </span>

                  <div className="mt-1 space-y-0.5 overflow-hidden max-h-[52px]">
                    {cellTasks.slice(0, 2).map((t) => (
                      <div
                        key={t._id}
                        className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate border ${statusColor(t.status)}`}
                      >
                        {t.project?.emoji ?? ""} {t.title}
                      </div>
                    ))}
                    {cellTasks.length > 2 && (
                      <div className="text-[10px] text-muted-foreground pl-1">
                        +{cellTasks.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Selected Day Detail ── */}
      {selectedDate && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="text-lg font-semibold mb-3">
            Tasks for {formatDate(selectedDate)}
          </h4>
          {selectedTasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No tasks scheduled for this day.
            </p>
          ) : (
            <div className="space-y-3">
              {selectedTasks.map((task) => (
                <TaskCard key={task._id} task={task} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Upcoming Tasks ── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          <h4 className="text-lg font-semibold">Upcoming Tasks</h4>
        </div>

        {upcomingTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="text-sm">No upcoming tasks</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingTasks.slice(0, 10).map((task) => (
              <TaskCard key={task._id} task={task} showDate />
            ))}
            {upcomingTasks.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                And {upcomingTasks.length - 10} more…
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Task Card sub-component ──────────────────────────────
function TaskCard({
  task,
  showDate = false,
}: {
  task: TaskType;
  showDate?: boolean;
}) {
  const initials = task.assignedTo
    ? getAvatarFallbackText(task.assignedTo.name)
    : "NA";
  const avatarColor = getAvatarColor(initials);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
      {/* project emoji */}
      <span className="text-xl flex-shrink-0">
        {task.project?.emoji ?? "📋"}
      </span>

      {/* info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{task.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {task.project?.name ?? "No project"}
          {showDate && task.dueDate && (
            <span className="ml-2">
              · Due{" "}
              {new Date(task.dueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </p>
      </div>

      {/* badges */}
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0.5 ${statusColor(task.status)}`}
      >
        {statusLabel(task.status)}
      </Badge>
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0.5 ${priorityBadge(task.priority)}`}
      >
        {task.priority}
      </Badge>

      {/* assignee */}
      {task.assignedTo && (
        <Avatar className="h-7 w-7 flex-shrink-0">
          <AvatarImage
            src={task.assignedTo.profilePicture || ""}
            alt={task.assignedTo.name}
          />
          <AvatarFallback className={avatarColor}>{initials}</AvatarFallback>
        </Avatar>
      )}

      {/* task code */}
      <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
        {task.taskCode}
      </span>
    </div>
  );
}

export default CalendarView;
