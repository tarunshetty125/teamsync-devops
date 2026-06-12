import { useContext, useEffect } from "react";
import { SocketContext } from "./socket-context";

export const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }

  return context;
};

export const useProjectRealtimeRoom = (projectId?: string | null) => {
  const { joinProject, leaveProject } = useSocket();

  useEffect(() => {
    if (!projectId) {
      return;
    }

    joinProject(projectId);
    return () => leaveProject(projectId);
  }, [joinProject, leaveProject, projectId]);
};

export const useTaskRealtimeRoom = (taskId?: string | null) => {
  const { joinTask, leaveTask } = useSocket();

  useEffect(() => {
    if (!taskId) {
      return;
    }

    joinTask(taskId);
    return () => leaveTask(taskId);
  }, [joinTask, leaveTask, taskId]);
};
