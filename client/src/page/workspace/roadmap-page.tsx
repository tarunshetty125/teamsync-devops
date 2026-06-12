import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MilestoneModal from "@/components/workspace/timeline/milestone-modal";
import { TaskStatusEnum, TaskStatusEnumType } from "@/constant";
import useWorkspaceId from "@/hooks/use-workspace-id";
import {
  getLabelsQueryFn,
  getMembersInWorkspaceQueryFn,
  getProjectsInWorkspaceQueryFn,
  getTimelineQueryFn,
} from "@/lib/api";
import {
  MilestoneStatusType,
  MilestoneType,
  TimelineProjectType,
  TimelineRangeType,
} from "@/types/api.type";

const rangeOptions: TimelineRangeType[] = ["30d", "90d", "180d", "365d"];
const allValue = "all";

const statusClass: Record<MilestoneStatusType, string> = {
  PLANNED: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
};

const formatDate = (value?: string | null) => {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const getSingleParam = (params: URLSearchParams, key: string) =>
  params.get(key) || allValue;

const toArray = (value: string) => (value === allValue ? undefined : [value]);

export default function RoadmapPage() {
  const workspaceId = useWorkspaceId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [scale, setScale] = useState<"month" | "quarter">("month");
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

  const roadmapQuery = useQuery({
    queryKey: [
      "roadmap",
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
    queryKey: ["projects", workspaceId, "roadmap-options"],
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
    queryKey: ["labels", workspaceId, "roadmap-options"],
    queryFn: () =>
      getLabelsQueryFn({ workspaceId, pageSize: 100, pageNumber: 1 }),
    enabled: !!workspaceId,
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
  const roadmap = roadmapQuery.data?.timeline;

  const milestonesByProject = useMemo(() => {
    const grouped = new Map<string, MilestoneType[]>();
    for (const milestone of roadmap?.milestones || []) {
      const items = grouped.get(milestone.project) || [];
      items.push(milestone);
      grouped.set(milestone.project, items);
    }
    return grouped;
  }, [roadmap?.milestones]);

  const openMilestone = (milestone: MilestoneType | null) => {
    setEditingMilestone(milestone);
    setMilestoneModalOpen(true);
  };

  return (
    <div className="w-full space-y-6 py-4 md:pt-3">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Roadmap</h2>
          <p className="text-muted-foreground">
            Project milestones by month or quarter.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={scale}
            onValueChange={(value) => setScale(value as "month" | "quarter")}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => openMilestone(null)}>
            <Plus className="h-4 w-4" />
            Create Milestone
          </Button>
        </div>
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

      {roadmapQuery.isLoading ? (
        <div className="h-[360px] rounded-lg border bg-muted/30" />
      ) : null}
      {roadmapQuery.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Roadmap could not be loaded.
        </div>
      ) : null}
      {roadmap ? (
        <div className="rounded-lg border bg-background">
          <div className="border-b bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground">
            {scale === "month" ? "Month scale" : "Quarter scale"} ·{" "}
            {formatDate(roadmap.range.startDate)} -{" "}
            {formatDate(roadmap.range.endDate)}
          </div>
          <div className="divide-y">
            {roadmap.projects.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No roadmap items match the current filters.
              </div>
            ) : (
              roadmap.projects.map((project) => {
                const milestones = milestonesByProject.get(project._id) || [];
                return (
                  <div key={project._id} className="grid gap-3 p-4 md:grid-cols-[220px_1fr]">
                    <div>
                      <p className="font-medium">
                        {`${project.emoji || ""} ${project.name}`.trim()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {milestones.length} milestone
                        {milestones.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {milestones.length === 0 ? (
                        <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                          No milestones in this range.
                        </div>
                      ) : (
                        milestones.map((milestone) => (
                          <button
                            key={milestone._id}
                            type="button"
                            className="flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left hover:bg-muted/30"
                            onClick={() => openMilestone(milestone)}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {milestone.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(milestone.startDate)} -{" "}
                                {formatDate(milestone.dueDate)}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className={statusClass[milestone.status]}
                            >
                              {milestone.status.replace("_", " ")}
                            </Badge>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      <MilestoneModal
        open={milestoneModalOpen}
        onOpenChange={setMilestoneModalOpen}
        workspaceId={workspaceId}
        projects={projectOptions}
        milestone={editingMilestone}
      />
    </div>
  );
}
