import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TargetDiscussion from "@/components/workspace/comment/target-discussion";
import { useTaskRealtimeRoom } from "@/realtime/use-socket";
import { TaskType } from "@/types/api.type";
import { lazy, Suspense } from "react";
import AdvancedTaskPanel from "./advanced-task-panel";
import EditTaskForm from "./edit-task-form";
import TaskTimePanel from "./task-time-panel";

const AttachmentPanel = lazy(
  () => import("@/components/workspace/file/attachment-panel")
);

const TaskDetailsDialog = ({
  task,
  isOpen,
  onClose,
}: {
  task: TaskType;
  isOpen: boolean;
  onClose: () => void;
}) => {
  useTaskRealtimeRoom(isOpen ? task._id : null);

  return (
    <Dialog modal={true} open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-0 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="comments">
          <TabsList>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="time">Time</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value="comments" className="pt-2">
            <TargetDiscussion targetType="TASK" targetId={task._id} />
          </TabsContent>
          <TabsContent value="files" className="pt-2">
            <Suspense
              fallback={<div className="h-40 rounded-md border bg-muted/30" />}
            >
              <AttachmentPanel targetType="TASK" targetId={task._id} />
            </Suspense>
          </TabsContent>
          <TabsContent value="advanced" className="pt-2">
            <AdvancedTaskPanel task={task} />
          </TabsContent>
          <TabsContent value="time" className="pt-2">
            <TaskTimePanel task={task} />
          </TabsContent>
          <TabsContent value="details" className="pt-2">
            <EditTaskForm task={task} onClose={onClose} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDetailsDialog;
