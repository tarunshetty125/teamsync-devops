import { lazy, Suspense, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import GanttChart from "@/components/workspace/gantt/gantt-chart";
import ScheduleEditModal from "@/components/workspace/gantt/schedule-edit-modal";
import MilestoneModal from "@/components/workspace/timeline/milestone-modal";
import { Permissions, TaskStatusEnum, TaskStatusEnumType } from "@/constant";
import { useAuthContext } from "@/context/auth-provider";
import useWorkspaceId from "@/hooks/use-workspace-id";
import { toast } from "@/hooks/use-toast";
import {
  getGanttQueryFn,
  getLabelsQueryFn,
  getMembersInWorkspaceQueryFn,
  getProjectsInWorkspaceQueryFn,
  getTaskByIdQueryFn,
  updateTaskScheduleMutationFn,
} from "@/lib/api";
import {
  GanttTaskType,
  MilestoneType,
  TimelineProjectType,
  TimelineRangeType,
} from "@/types/api.type";

const TaskDetailsDialog = lazy(
  () => import("@/components/workspace/task/task-details-dialog")
);

const rangeOptions: TimelineRangeType[] = ["30d", "90d", "180d", "365d"];
const allValue = "all";

type ScheduleOverride = {
  startDate: string;
  endDate: string;
} | null;

const getSingleParam = (params: URLSearchParams, key: string) =>
  params.get(key) || allValue;

const toArray = (value: string) => (value === allValue ? undefined : [value]);

const maxDateString = (left: string, right: string) =>
  new Date(left).getTime() > new Date(right).getTime() ? left : right;

const minDateString = (left: string, right: string) =>
  new Date(left).getTime() < new Date(right).getTime() ? left : right;

export default function GanttPage() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthContext();
  const canEditSchedule = hasPermission(Permissions.EDIT_TASK);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTask, setSelectedTask] = useState<GanttTaskType | null>(null);
  const [scheduleTask, setScheduleTask] = useState<GanttTaskType | null>(null);
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<MilestoneType | null>(
    null
  );
  const [optimisticSchedules, setOptimisticSchedules] = useState<
    Record<string, ScheduleOverride>
  >({});

  const range = (searchParams.get("range") || "90d") as TimelineRangeType;
  const projectId = getSingleParam(searchParams, "projectId");
  const assigneeId = getSingleParam(searchParams, "assigneeId");
  const labelId = getSingleParam(searchParams, "labelId");
  const status = getSingleParam(searchParams, "status");

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === allValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const ganttQuery = useQuery({
    queryKey: [
      "gantt",
      workspaceId,
      range,
      projectId,
      assigneeId,
      labelId,
      status,
    ],
    queryFn: () =>
      getGanttQueryFn({
        workspaceId,
        range,
        projectIds: toArray(projectId),
        assigneeIds: toArray(assigneeId),
        labelIds: toArray(labelId),
        statuses: toArray(status) as TaskStatusEnumType[] | undefined,
      }),
    enabled: !!workspaceId,
  });
  const projectsQuery = useQuery({
    queryKey: ["projects", workspaceId, "gantt-options"],
    queryFn: () =>
      getProjectsInWorkspaceQueryFn({
        workspaceId,
        pageSize: 100,
        pageNumber: 1,
      }),
    enabled: !!workspaceId,
  });
  const membersQuery = useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => getMembersInWorkspaceQueryFn(workspaceId),
    enabled: !!workspaceId,
  });
  const labelsQuery = useQuery({
    queryKey: ["labels", workspaceId, "gantt-options"],
    queryFn: () =>
      getLabelsQueryFn({ workspaceId, pageSize: 100, pageNumber: 1 }),
    enabled: !!workspaceId,
  });
  const taskDetailsQuery = useQuery({
    queryKey: [
      "task-details",
      workspaceId,
      selectedTask?.project,
      selectedTask?._id,
    ],
    queryFn: () =>
      getTaskByIdQueryFn({
        workspaceId,
        projectId: selectedTask?.project || "",
        taskId: selectedTask?._id || "",
      }),
    enabled: !!workspaceId && !!selectedTask,
  });

  const scheduleMutation = useMutation({
    mutationFn: updateTaskScheduleMutationFn,
  });

  const projectOptions: TimelineProjectType[] = useMemo(
    () =>
      (projectsQuery.data?.projects || []).map((project) => ({
        _id: project._id,
        name: project.name,
        emoji: project.emoji,
        description: project.description,
      })),
    [projectsQuery.data?.projects]
  );

  const gantt = ganttQuery.data?.gantt;
  const ganttTasks = useMemo(() => {
    if (!gantt) return [];

    return gantt.tasks.flatMap((task) => {
      if (!(task._id in optimisticSchedules)) return [task];
      const override = optimisticSchedules[task._id];
      if (override === null) return [];

      return [
        {
          ...task,
          startDate: override.startDate,
          endDate: override.endDate,
          dueDate: override.endDate,
          barStart: maxDateString(override.startDate, gantt.range.startDate),
          barEnd: minDateString(override.endDate, gantt.range.endDate),
        },
      ];
    });
  }, [gantt, optimisticSchedules]);

  const openMilestone = (milestone: MilestoneType | null) => {
    setEditingMilestone(milestone);
    setMilestoneModalOpen(true);
  };

  const saveSchedule = (
    task: GanttTaskType,
    startDate: string | null,
    endDate: string | null
  ) => {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast({
        title: "Invalid schedule",
        description: "Start date must be before or equal to end date.",
        variant: "destructive",
      });
      return;
    }

    setOptimisticSchedules((current) => ({
      ...current,
      [task._id]: startDate && endDate ? { startDate, endDate } : null,
    }));

    scheduleMutation.mutate(
      {
        workspaceId,
        taskId: task._id,
        data: { startDate, endDate },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["gantt", workspaceId] });
          queryClient.invalidateQueries({ queryKey: ["all-tasks", workspaceId] });
          queryClient.invalidateQueries({
            queryKey: ["task-details", workspaceId, task.project, task._id],
          });
          toast({ title: "Schedule updated", variant: "success" });
          setScheduleTask(null);
        },
        onError: (error) => {
          setOptimisticSchedules((current) => {
            const next = { ...current };
            delete next[task._id];
            return next;
          });
          toast({
            title: "Schedule update failed",
            description: error.message,
            variant: "destructive",
          });
        },
        onSettled: () => {
          setOptimisticSchedules((current) => {
            const next = { ...current };
            delete next[task._id];
            return next;
          });
        },
      }
    );
  };

  return (
    <div className="w-full space-y-6 py-4 md:pt-3">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gantt</h2>
          <p className="text-muted-foreground">
            Editable task schedules with dependency warnings.
          </p>
        </div>
        <Button onClick={() => openMilestone(null)}>
          <Plus className="h-4 w-4" />
          Create Milestone
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Select value={range} onValueChange={(value) => setFilter("range", value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rangeOptions.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={projectId}
          onValueChange={(value) => setFilter("projectId", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allValue}>All projects</SelectItem>
            {projectOptions.map((project) => (
              <SelectItem key={project._id} value={project._id}>
                {`${project.emoji || ""} ${project.name}`.trim()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={assigneeId}
          onValueChange={(value) => setFilter("assigneeId", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allValue}>All assignees</SelectItem>
            {(membersQuery.data?.members || []).map((member) => (
              <SelectItem key={member.userId._id} value={member.userId._id}>
                {member.userId.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={labelId} onValueChange={(value) => setFilter("labelId", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Label" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allValue}>All labels</SelectItem>
            {(labelsQuery.data?.labels || []).map((label) => (
              <SelectItem key={label._id} value={label._id}>
                {label.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => setFilter("status", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={allValue}>All statuses</SelectItem>
            {Object.values(TaskStatusEnum).map((item) => (
              <SelectItem key={item} value={item}>
                {item.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ganttQuery.isLoading ? (
        <div className="h-[440px] rounded-lg border bg-muted/30" />
      ) : null}
      {ganttQuery.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Gantt could not be loaded.
        </div>
      ) : null}
      {gantt ? (
        <GanttChart
          rangeStart={gantt.range.startDate}
          rangeEnd={gantt.range.endDate}
          projects={gantt.projects}
          tasks={ganttTasks}
          milestones={gantt.milestones}
          dependencies={gantt.dependencies}
          onTaskClick={setSelectedTask}
          onMilestoneClick={openMilestone}
          onScheduleChange={saveSchedule}
          onScheduleEdit={setScheduleTask}
          canEditSchedule={canEditSchedule}
        />
      ) : null}

      <MilestoneModal
        open={milestoneModalOpen}
        onOpenChange={setMilestoneModalOpen}
        workspaceId={workspaceId}
        projects={projectOptions}
        milestone={editingMilestone}
      />
      <ScheduleEditModal
        open={!!scheduleTask}
        onOpenChange={(open) => !open && setScheduleTask(null)}
        task={scheduleTask}
        isSaving={scheduleMutation.isPending}
        onSave={saveSchedule}
      />
      {taskDetailsQuery.data?.task && (
        <Suspense fallback={null}>
          <TaskDetailsDialog
            task={taskDetailsQuery.data.task}
            isOpen={!!selectedTask}
            onClose={() => setSelectedTask(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
