import { lazy, Suspense, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TargetDiscussion from "@/components/workspace/comment/target-discussion";
import ProjectAnalytics from "@/components/workspace/project/project-analytics";
import ProjectHeader from "@/components/workspace/project/project-header";
import TaskTable from "@/components/workspace/task/task-table";
import useWorkspaceId from "@/hooks/use-workspace-id";
import { getTaskByIdQueryFn } from "@/lib/api";
import {
  useProjectRealtimeRoom,
  useTaskRealtimeRoom,
} from "@/realtime/use-socket";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";

const KanbanBoard = lazy(
  () => import("@/components/workspace/task/board/kanban-board")
);
const TaskDetailsDialog = lazy(
  () => import("@/components/workspace/task/task-details-dialog")
);
const AttachmentPanel = lazy(
  () => import("@/components/workspace/file/attachment-panel")
);

const ProjectDetails = () => {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState("list");
  const workspaceId = useWorkspaceId();
  const projectId = params.projectId as string;
  const taskId = searchParams.get("taskId");
  useProjectRealtimeRoom(projectId);
  useTaskRealtimeRoom(taskId);

  const { data: taskData } = useQuery({
    queryKey: ["task-details", workspaceId, projectId, taskId],
    queryFn: () =>
      getTaskByIdQueryFn({
        workspaceId,
        projectId,
        taskId: taskId || "",
      }),
    enabled: !!workspaceId && !!projectId && !!taskId,
  });

  const handleCloseTaskDetails = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("taskId");
    nextParams.delete("commentId");
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="w-full space-y-6 py-4 md:pt-3">
      <ProjectHeader />
      <div className="space-y-5">
        <ProjectAnalytics />
        <Separator />
        <Tabs value={view} onValueChange={setView} className="space-y-4">
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
          </TabsList>
          <TabsContent value="list">
            <TaskTable />
          </TabsContent>
          <TabsContent value="board">
            {view === "board" && (
              <Suspense
                fallback={
                  <div className="h-[520px] rounded-md border bg-muted/30" />
                }
              >
                <KanbanBoard projectId={projectId} />
              </Suspense>
            )}
          </TabsContent>
        </Tabs>
        <Separator />
        <Suspense fallback={<div className="h-40 rounded-md border bg-muted/30" />}>
          <AttachmentPanel targetType="PROJECT" targetId={projectId} />
        </Suspense>
        <Separator />
        <TargetDiscussion targetType="PROJECT" targetId={projectId} />
      </div>
      {taskData?.task && (
        <Suspense fallback={null}>
          <TaskDetailsDialog
            task={taskData.task}
            isOpen={!!taskId}
            onClose={handleCloseTaskDetails}
          />
        </Suspense>
      )}
    </div>
  );
};

export default ProjectDetails;
