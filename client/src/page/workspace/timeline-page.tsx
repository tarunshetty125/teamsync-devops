import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import MilestoneModal from "@/components/workspace/timeline/milestone-modal";
import TimelineChart from "@/components/workspace/timeline/timeline-chart";
import { TaskStatusEnum, TaskStatusEnumType } from "@/constant";
import useWorkspaceId from "@/hooks/use-workspace-id";
import {
  getLabelsQueryFn,
  getMembersInWorkspaceQueryFn,
  getProjectsInWorkspaceQueryFn,
  getTaskByIdQueryFn,
  getTimelineQueryFn,
} from "@/lib/api";
import {
  MilestoneType,
  TimelineProjectType,
  TimelineRangeType,
  TimelineTaskType,
} from "@/types/api.type";

const TaskDetailsDialog = lazy(
  () => import("@/components/workspace/task/task-details-dialog")
);

const rangeOptions: TimelineRangeType[] = ["30d", "90d", "180d", "365d"];
const allValue = "all";

const getSingleParam = (params: URLSearchParams, key: string) =>
  params.get(key) || allValue;

const toArray = (value: string) => (value === allValue ? undefined : [value]);

export default function TimelinePage() {
  const workspaceId = useWorkspaceId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTask, setSelectedTask] = useState<TimelineTaskType | null>(null);
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<MilestoneType | null>(
    null
  );

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

  const timelineQuery = useQuery({
    queryKey: [
      "timeline",
      workspaceId,
      range,
      projectId,
      assigneeId,
      labelId,
      status,
    ],
    queryFn: () =>
      getTimelineQueryFn({
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
    queryKey: ["projects", workspaceId, "timeline-options"],
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
    queryKey: ["labels", workspaceId, "timeline-options"],
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
  const timeline = timelineQuery.data?.timeline;

  const openMilestone = (milestone: MilestoneType | null) => {
    setEditingMilestone(milestone);
    setMilestoneModalOpen(true);
  };

  return (
    <div className="premium-page">
      <div className="premium-page-header">
        <div>
          <h2 className="premium-heading">Timeline</h2>
          <p className="premium-muted">
            Read-only planning view across tasks, milestones, and dependencies.
          </p>
        </div>
        <Button onClick={() => openMilestone(null)}>
          <Plus className="h-4 w-4" />
          Create Milestone
        </Button>
      </div>

      <div className="grid gap-3 rounded-lg border border-border/70 bg-card p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:grid-cols-5">
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

      {timelineQuery.isLoading ? (
        <div className="h-[420px] rounded-lg border bg-muted/30 animate-pulse" />
      ) : null}
      {timelineQuery.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Timeline could not be loaded.
        </div>
      ) : null}
      {timeline ? (
        <TimelineChart
          rangeStart={timeline.range.startDate}
          rangeEnd={timeline.range.endDate}
          projects={timeline.projects}
          tasks={timeline.tasks}
          milestones={timeline.milestones}
          dependencies={timeline.dependencies}
          onTaskClick={setSelectedTask}
          onMilestoneClick={openMilestone}
        />
      ) : null}

      <MilestoneModal
        open={milestoneModalOpen}
        onOpenChange={setMilestoneModalOpen}
        workspaceId={workspaceId}
        projects={projectOptions}
        milestone={editingMilestone}
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
