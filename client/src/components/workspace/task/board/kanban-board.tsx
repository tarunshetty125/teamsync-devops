import { lazy, Suspense, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { format } from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  Loader,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTableFacetedFilter } from "@/components/workspace/task/table/table-faceted-filter";
import { priorities } from "@/components/workspace/task/table/data";
import { Permissions, TaskStatusEnum, TaskStatusEnumType } from "@/constant";
import { useAuthContext } from "@/context/auth-provider";
import useGetWorkspaceMembers from "@/hooks/api/use-get-workspace-members";
import PresenceIndicator from "@/components/realtime/presence-indicator";
import useTaskTableFilter from "@/hooks/use-task-table-filter";
import useWorkspaceId from "@/hooks/use-workspace-id";
import {
  editTaskMutationFn,
  getKanbanTasksQueryFn,
  getLabelsQueryFn,
} from "@/lib/api";
import {
  getAvatarColor,
  getAvatarFallbackText,
  transformOptions,
} from "@/lib/helper";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  KanbanColumnType,
  KanbanResponseType,
  KanbanTaskType,
  TaskType,
} from "@/types/api.type";

const TaskDetailsDialog = lazy(() => import("../task-details-dialog"));

const COLUMN_LIMIT = 20;

type BoardFilters = ReturnType<typeof useTaskTableFilter>[0];
type SetBoardFilters = ReturnType<typeof useTaskTableFilter>[1];

const statusOptions = transformOptions(Object.values(TaskStatusEnum));

const formatEnumLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const statusAccentClass = (status: TaskStatusEnumType) => {
  switch (status) {
    case TaskStatusEnum.DONE:
      return "border-emerald-200 bg-emerald-50/60";
    case TaskStatusEnum.IN_REVIEW:
      return "border-violet-200 bg-violet-50/60";
    case TaskStatusEnum.IN_PROGRESS:
      return "border-amber-200 bg-amber-50/60";
    case TaskStatusEnum.TODO:
      return "border-blue-200 bg-blue-50/60";
    default:
      return "border-slate-200 bg-slate-50/70";
  }
};

const queryKeyForBoard = (
  workspaceId: string,
  projectId: string | undefined,
  filters: BoardFilters,
  labelIds: string
) => [
  "kanban-tasks",
  workspaceId,
  projectId || null,
  filters.keyword || null,
  filters.priority || null,
  filters.assigneeId || null,
  labelIds || null,
];

const moveTaskInBoardData = (
  data: KanbanResponseType,
  task: KanbanTaskType,
  nextStatus: TaskStatusEnumType
): KanbanResponseType => {
  const previousStatus = task.status;

  if (previousStatus === nextStatus) {
    return data;
  }

  const movedTask = {
    ...task,
    status: nextStatus,
  };

  const columns = data.columns.map((column) => {
    const withoutTask = column.tasks.filter((item) => item._id !== task._id);

    if (column.status === previousStatus) {
      return {
        ...column,
        totalCount: Math.max(0, column.totalCount - 1),
        tasks: withoutTask,
      };
    }

    if (column.status === nextStatus) {
      return {
        ...column,
        totalCount: column.totalCount + 1,
        tasks: [movedTask, ...withoutTask],
      };
    }

    return {
      ...column,
      tasks: withoutTask,
    };
  });

  return {
    ...data,
    columns,
    columnCounts: {
      ...data.columnCounts,
      [previousStatus]: Math.max(0, (data.columnCounts[previousStatus] || 0) - 1),
      [nextStatus]: (data.columnCounts[nextStatus] || 0) + 1,
    },
  };
};

function KanbanCard({
  task,
  canMove,
  enableDrag = true,
  onOpen,
  onMove,
  isDraggingOverlay = false,
}: {
  task: KanbanTaskType;
  canMove: boolean;
  enableDrag?: boolean;
  onOpen: (task: TaskType) => void;
  onMove: (task: KanbanTaskType, status: TaskStatusEnumType) => void;
  isDraggingOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task._id,
      data: { task },
      disabled: !enableDrag || !canMove || isDraggingOverlay,
    });

  const assigneeName = task.assignedTo?.name || "";
  const initials = getAvatarFallbackText(assigneeName);
  const avatarColor = getAvatarColor(assigneeName);
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border/70 bg-background p-3 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md",
        canMove && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
        isDraggingOverlay && "w-[280px] rotate-1 border-primary/30 shadow-xl"
      )}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={() => onOpen(task)}
      >
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className="h-6 shrink-0">
            {task.taskCode}
          </Badge>
          <Badge variant="secondary" className="shrink-0 uppercase tracking-wide">
            {formatEnumLabel(task.priority)}
          </Badge>
        </div>
        <div className="mt-2 line-clamp-2 text-sm font-semibold leading-5">
          {task.title}
        </div>
        {task.description && (
          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {task.description}
          </div>
        )}
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {task.dueDate && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {format(new Date(task.dueDate), "MMM d")}
          </span>
        )}
        {task.subtaskDepth ? (
          <span className="inline-flex items-center gap-1">
            Level {task.subtaskDepth}
          </span>
        ) : null}
        {task.isBlocked && (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            Blocked by {task.blockedByCount}
          </span>
        )}
      </div>

      {task.labels && task.labels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((label) => (
            <span
              key={label._id}
              className="inline-flex items-center gap-1 rounded-md border bg-muted/35 px-1.5 py-0.5 text-[11px]"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              {label.name}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="rounded border px-1.5 py-0.5 text-[11px]">
              +{task.labels.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        {task.assignedTo ? (
          <Avatar className="h-7 w-7">
            <AvatarImage
              src={task.assignedTo.profilePicture || ""}
              alt={assigneeName}
            />
            <AvatarFallback className={avatarColor}>{initials}</AvatarFallback>
          </Avatar>
        ) : (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-muted/30 text-muted-foreground">
            <UserRound className="h-3.5 w-3.5" />
          </span>
        )}

        <div className="w-[150px] md:hidden">
          <Select
            disabled={!canMove}
            value={task.status}
            onValueChange={(value) =>
              onMove(task, value as TaskStatusEnumType)
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Move" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({
  column,
  canMove,
  onOpenTask,
  onMoveTask,
  onLoadMore,
  isLoadingMore,
}: {
  column: KanbanColumnType;
  canMove: boolean;
  onOpenTask: (task: TaskType) => void;
  onMoveTask: (task: KanbanTaskType, status: TaskStatusEnumType) => void;
  onLoadMore: (column: KanbanColumnType) => void;
  isLoadingMore: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
    data: { status: column.status },
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-h-[520px] min-w-[260px] flex-col rounded-lg border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        statusAccentClass(column.status),
        isOver && "border-primary bg-primary/5 shadow-md"
      )}
    >
      <div className="flex h-12 items-center justify-between border-b border-border/70 px-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">
            {formatEnumLabel(column.status)}
          </h3>
        </div>
        <Badge variant="secondary">{column.totalCount}</Badge>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {column.tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-background/70 p-4 text-center text-sm text-muted-foreground">
            No tasks
          </div>
        ) : (
          column.tasks.map((task) => (
            <KanbanCard
              key={task._id}
                task={task}
                canMove={canMove}
                enableDrag
                onOpen={onOpenTask}
                onMove={onMoveTask}
            />
          ))
        )}
      </div>
      {column.hasMore && (
        <div className="border-t border-border/70 p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isLoadingMore}
            onClick={() => onLoadMore(column)}
          >
            {isLoadingMore && <Loader className="h-4 w-4 animate-spin" />}
            Load more
          </Button>
        </div>
      )}
    </section>
  );
}

function BoardFiltersToolbar({
  isLoading,
  filters,
  setFilters,
  selectedLabels,
  setSelectedLabels,
}: {
  isLoading?: boolean;
  filters: BoardFilters;
  setFilters: SetBoardFilters;
  selectedLabels: string[];
  setSelectedLabels: (labels: string[]) => void;
}) {
  const workspaceId = useWorkspaceId();
  const { data: memberData } = useGetWorkspaceMembers(workspaceId);
  const { data: labelData } = useQuery({
    queryKey: ["labels", workspaceId],
    queryFn: () => getLabelsQueryFn({ workspaceId, pageSize: 100 }),
    enabled: !!workspaceId,
  });

  const members = memberData?.members || [];
  const labels = labelData?.labels || [];

  const assigneesOptions = members.map((member) => {
    const name = member.userId?.name || "Unknown";
    const initials = getAvatarFallbackText(name);
    const avatarColor = getAvatarColor(name);

    return {
      label: (
        <div className="flex items-center space-x-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={member.userId?.profilePicture || ""} alt={name} />
            <AvatarFallback className={avatarColor}>{initials}</AvatarFallback>
          </Avatar>
          <span>{name}</span>
          <PresenceIndicator userId={member.userId._id} />
        </div>
      ),
      value: member.userId._id,
    };
  });

  const labelOptions = labels.map((label) => ({
    label: (
      <span className="inline-flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: label.color }}
        />
        {label.name}
      </span>
    ),
    value: label._id,
    icon: Tag,
  }));

  const handleFilterChange = (key: keyof BoardFilters, values: string[]) => {
    setFilters({
      ...filters,
      [key]: values.length > 0 ? values.join(",") : null,
    });
  };

  const hasFilters =
    Object.values(filters).some((value) => value !== null && value !== "") ||
    selectedLabels.length > 0;

  return (
    <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center">
      <Input
        placeholder="Search tasks..."
        value={filters.keyword || ""}
        onChange={(event) =>
          setFilters({
            ...filters,
            keyword: event.target.value || null,
          })
        }
        className="h-8 w-full lg:w-[250px]"
      />
      <DataTableFacetedFilter
        title="Priority"
        multiSelect
        options={priorities}
        disabled={isLoading}
        selectedValues={filters.priority?.split(",") || []}
        onFilterChange={(values) => handleFilterChange("priority", values)}
      />
      <DataTableFacetedFilter
        title="Assigned To"
        multiSelect
        options={assigneesOptions}
        disabled={isLoading}
        selectedValues={filters.assigneeId?.split(",") || []}
        onFilterChange={(values) => handleFilterChange("assigneeId", values)}
      />
      <DataTableFacetedFilter
        title="Labels"
        multiSelect
        options={labelOptions}
        disabled={isLoading}
        selectedValues={selectedLabels}
        onFilterChange={setSelectedLabels}
      />
      {hasFilters && (
        <Button
          disabled={isLoading}
          variant="ghost"
          className="h-8 px-2 lg:px-3"
          onClick={() => {
            setFilters({
              keyword: null,
              status: null,
              priority: null,
              projectId: null,
              assigneeId: null,
            });
            setSelectedLabels([]);
          }}
        >
          Reset
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export default function KanbanBoard({ projectId }: { projectId?: string }) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthContext();
  const [filters, setFilters] = useTaskTableFilter();
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [activeTask, setActiveTask] = useState<KanbanTaskType | null>(null);
  const [detailsTask, setDetailsTask] = useState<TaskType | null>(null);

  const labelIds = selectedLabels.join(",");
  const boardQueryKey = queryKeyForBoard(
    workspaceId,
    projectId,
    filters,
    labelIds
  );
  const canMoveTasks = hasPermission(Permissions.EDIT_TASK);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: boardQueryKey,
    queryFn: () =>
      getKanbanTasksQueryFn({
        workspaceId,
        projectId,
        keyword: filters.keyword,
        priority: filters.priority,
        assignedTo: filters.assigneeId,
        labelIds,
        columnLimit: COLUMN_LIMIT,
      }),
    enabled: !!workspaceId,
  });

  const columns = useMemo(() => data?.columns || [], [data?.columns]);

  const updateStatusMutation = useMutation({
    mutationFn: ({
      task,
      nextStatus,
    }: {
      task: KanbanTaskType;
      nextStatus: TaskStatusEnumType;
    }) => {
      const currentProjectId = task.project?._id;

      if (!currentProjectId) {
        throw new Error("Task project is required to move this task");
      }

      return editTaskMutationFn({
        workspaceId,
        projectId: currentProjectId,
        taskId: task._id,
        data: { status: nextStatus },
      });
    },
    onMutate: async ({ task, nextStatus }) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey });
      const previousBoard =
        queryClient.getQueryData<KanbanResponseType>(boardQueryKey);

      queryClient.setQueryData<KanbanResponseType>(boardQueryKey, (current) =>
        current ? moveTaskInBoardData(current, task, nextStatus) : current
      );

      return { previousBoard };
    },
    onError: (error, _variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(boardQueryKey, context.previousBoard);
      }
      queryClient.invalidateQueries({ queryKey: boardQueryKey });
      toastError(error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKey });
      queryClient.invalidateQueries({ queryKey: ["all-tasks", workspaceId] });
    },
  });

  const loadMoreMutation = useMutation({
    mutationFn: (column: KanbanColumnType) =>
      getKanbanTasksQueryFn({
        workspaceId,
        projectId,
        keyword: filters.keyword,
        priority: filters.priority,
        assignedTo: filters.assigneeId,
        labelIds,
        status: column.status,
        cursor: column.nextCursor,
        columnLimit: COLUMN_LIMIT,
      }),
    onSuccess: (nextPage) => {
      const nextColumn = nextPage.columns[0];

      if (!nextColumn) {
        return;
      }

      queryClient.setQueryData<KanbanResponseType>(boardQueryKey, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          columnCounts: nextPage.columnCounts,
          columns: current.columns.map((column) => {
            if (column.status !== nextColumn.status) {
              return column;
            }

            const existingTaskIds = new Set(
              column.tasks.map((task) => task._id)
            );
            const mergedTasks = [
              ...column.tasks,
              ...nextColumn.tasks.filter(
                (task) => !existingTaskIds.has(task._id)
              ),
            ];

            return {
              ...column,
              tasks: mergedTasks,
              totalCount: nextColumn.totalCount,
              hasMore: nextColumn.hasMore,
              nextCursor: nextColumn.nextCursor,
            };
          }),
        };
      });
    },
    onError: toastError,
  });

  const handleMoveTask = (
    task: KanbanTaskType,
    nextStatus: TaskStatusEnumType
  ) => {
    if (!canMoveTasks || task.status === nextStatus) {
      return;
    }

    updateStatusMutation.mutate({ task, nextStatus });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as KanbanTaskType | undefined;
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const task = event.active.data.current?.task as KanbanTaskType | undefined;
    const nextStatus = event.over?.data.current?.status as
      | TaskStatusEnumType
      | undefined;

    setActiveTask(null);

    if (!task || !nextStatus) {
      return;
    }

    handleMoveTask(task, nextStatus);
  };

  return (
    <div className="space-y-4">
      <BoardFiltersToolbar
        isLoading={isLoading || isFetching}
        filters={filters}
        setFilters={setFilters}
        selectedLabels={selectedLabels}
        setSelectedLabels={setSelectedLabels}
      />

      <div className="hidden overflow-x-auto pb-2 md:block">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveTask(null)}
        >
          <div className="grid min-w-[1280px] grid-cols-5 gap-4">
            {isLoading
              ? Object.values(TaskStatusEnum).map((status) => (
                  <section
                    key={status}
                    className="min-h-[520px] rounded-lg border bg-card p-3 shadow-sm"
                  >
                    <div className="h-5 w-28 rounded-md bg-muted" />
                    <div className="mt-4 space-y-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-28 rounded-lg border bg-background"
                        />
                      ))}
                    </div>
                  </section>
                ))
              : columns.map((column) => (
                  <KanbanColumn
                    key={column.status}
                    column={column}
                    canMove={canMoveTasks}
                    onOpenTask={setDetailsTask}
                    onMoveTask={handleMoveTask}
                    onLoadMore={(nextColumn) =>
                      loadMoreMutation.mutate(nextColumn)
                    }
                    isLoadingMore={loadMoreMutation.isPending}
                  />
                ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <KanbanCard
                task={activeTask}
                canMove={false}
                onOpen={setDetailsTask}
                onMove={handleMoveTask}
                isDraggingOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <div className="space-y-4 md:hidden">
        {isLoading
          ? Object.values(TaskStatusEnum).map((status) => (
              <section key={status} className="rounded-lg border bg-card p-3">
                <div className="h-5 w-28 rounded bg-muted" />
                <div className="mt-3 h-24 rounded-lg border bg-background" />
              </section>
            ))
          : columns.map((column) => (
              <section
                key={column.status}
                className={cn("rounded-lg border bg-card", statusAccentClass(column.status))}
              >
                <div className="flex h-12 items-center justify-between border-b border-border/70 px-3">
                  <h3 className="text-sm font-semibold">
                    {formatEnumLabel(column.status)}
                  </h3>
                  <Badge variant="secondary">{column.totalCount}</Badge>
                </div>
                <div className="space-y-3 p-3">
                  {column.tasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed bg-background/70 p-4 text-center text-sm text-muted-foreground">
                      No tasks
                    </div>
                  ) : (
                    column.tasks.map((task) => (
                      <KanbanCard
                        key={task._id}
                        task={task}
                        canMove={canMoveTasks}
                        enableDrag={false}
                        onOpen={setDetailsTask}
                        onMove={handleMoveTask}
                      />
                    ))
                  )}
                  {column.hasMore && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={loadMoreMutation.isPending}
                      onClick={() => loadMoreMutation.mutate(column)}
                    >
                      {loadMoreMutation.isPending && (
                        <Loader className="h-4 w-4 animate-spin" />
                      )}
                      Load more
                    </Button>
                  )}
                </div>
              </section>
            ))}
      </div>

      {detailsTask && (
        <Suspense fallback={null}>
          <TaskDetailsDialog
            task={detailsTask}
            isOpen={!!detailsTask}
            onClose={() => setDetailsTask(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

function toastError(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  toast({
    title: "Error",
    description: message,
    variant: "destructive",
  });
}
