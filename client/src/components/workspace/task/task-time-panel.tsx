import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Square } from "lucide-react";

import TimeConflictDialog from "@/components/productivity/time-conflict-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Permissions } from "@/constant";
import { useAuthContext } from "@/context/auth-provider";
import { toast } from "@/hooks/use-toast";
import useWorkspaceId from "@/hooks/use-workspace-id";
import {
  getActiveTimerQueryFn,
  startTimerMutationFn,
  stopTimerMutationFn,
} from "@/lib/api";
import {
  StartTimerPayloadType,
  StartTimerResponseType,
  TaskType,
  TimeEntryType,
} from "@/types/api.type";

const formatSeconds = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
};

type TimerConflictError = Error & {
  response?: {
    status?: number;
    data?: StartTimerResponseType;
  };
};

export default function TaskTimePanel({ task }: { task: TaskType }) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthContext();
  const [note, setNote] = useState("");
  const [pendingStart, setPendingStart] =
    useState<StartTimerPayloadType["data"] | null>(null);
  const [conflictTimer, setConflictTimer] = useState<TimeEntryType | null>(null);
  const canTrackTime = hasPermission(Permissions.TRACK_TIME);

  const activeTimerQuery = useQuery({
    queryKey: ["time-active", workspaceId],
    queryFn: () => getActiveTimerQueryFn(workspaceId),
    enabled: Boolean(workspaceId && canTrackTime),
  });
  const activeTimer = activeTimerQuery.data?.activeTimer;
  const isThisTaskTimer = activeTimer?.task === task._id;

  const invalidateTime = () => {
    queryClient.invalidateQueries({ queryKey: ["time-active", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["time-entries", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["timesheet", workspaceId] });
  };

  const startTimer = useMutation({
    mutationFn: startTimerMutationFn,
    onSuccess: () => {
      setNote("");
      setPendingStart(null);
      setConflictTimer(null);
      invalidateTime();
      toast({ title: "Task timer started", variant: "success" });
    },
    onError: (error: TimerConflictError) => {
      if (error.response?.status === 409) {
        setConflictTimer(error.response.data?.activeTimer || null);
        return;
      }

      toast({
        title: "Timer could not start",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  const stopTimer = useMutation({
    mutationFn: stopTimerMutationFn,
    onSuccess: () => {
      invalidateTime();
      toast({ title: "Timer stopped", variant: "success" });
    },
    onError: (error: Error) =>
      toast({
        title: "Timer could not stop",
        description: error.message,
        variant: "destructive",
      }),
  });

  if (!canTrackTime) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        You do not have permission to track time.
      </div>
    );
  }

  const startData = {
    taskId: task._id,
    note: note || undefined,
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium">
              {task.taskCode} {task.title}
            </p>
            <p className="text-xs text-muted-foreground">
              Track focused work against this task.
            </p>
          </div>
          {isThisTaskTimer ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {formatSeconds(activeTimer.currentDurationSeconds)}
              </Badge>
              <Button
                type="button"
                variant="destructive"
                className="gap-2"
                onClick={() => stopTimer.mutate(workspaceId)}
                disabled={stopTimer.isPending}
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              className="gap-2"
              onClick={() => {
                setPendingStart(startData);
                startTimer.mutate({ workspaceId, data: startData });
              }}
              disabled={startTimer.isPending}
            >
              <Play className="h-4 w-4" />
              Start Task Timer
            </Button>
          )}
        </div>
        {!activeTimer && (
          <Textarea
            className="mt-3"
            placeholder="Optional timer note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        )}
        {activeTimer && !isThisTaskTimer && (
          <p className="mt-3 text-xs text-muted-foreground">
            Another timer is already running.
          </p>
        )}
      </div>

      <TimeConflictDialog
        open={Boolean(conflictTimer)}
        activeTimer={conflictTimer}
        isStopping={stopTimer.isPending}
        onStopExisting={() => {
          if (!pendingStart) return;
          stopTimer.mutate(workspaceId, {
            onSuccess: () =>
              startTimer.mutate({ workspaceId, data: pendingStart }),
          });
        }}
        onContinueExisting={() => {
          setConflictTimer(null);
          setPendingStart(null);
        }}
        onCancel={() => {
          setConflictTimer(null);
          setPendingStart(null);
        }}
      />
    </div>
  );
}
