import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Clock,
  Loader2,
  Play,
  Plus,
  Square,
  Timer,
  Trash2,
} from "lucide-react";

import TimeConflictDialog from "@/components/productivity/time-conflict-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Permissions } from "@/constant";
import { useAuthContext } from "@/context/auth-provider";
import { toast } from "@/hooks/use-toast";
import useWorkspaceId from "@/hooks/use-workspace-id";
import {
  createTimeEntryMutationFn,
  deleteTimeEntryMutationFn,
  getActiveTimerQueryFn,
  getAllTasksQueryFn,
  getMembersInWorkspaceQueryFn,
  getProductivityCapacityQueryFn,
  getProductivityWorkloadQueryFn,
  getProjectsInWorkspaceQueryFn,
  getTimeEntriesQueryFn,
  getTimesheetQueryFn,
  startTimerMutationFn,
  stopTimerMutationFn,
  updateCapacityMutationFn,
} from "@/lib/api";
import {
  ProductivityRangeType,
  StartTimerPayloadType,
  StartTimerResponseType,
  TimeEntryType,
} from "@/types/api.type";

const ranges: { label: string; value: ProductivityRangeType }[] = [
  { label: "7 days", value: "7d" },
  { label: "14 days", value: "14d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];

const nowInput = () => new Date().toISOString().slice(0, 16);

const oneHourAgoInput = () => {
  const date = new Date();
  date.setHours(date.getHours() - 1);
  return date.toISOString().slice(0, 16);
};

const formatSeconds = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(remainingSeconds).padStart(2, "0")}`;
};

const formatHours = (seconds: number) => `${(seconds / 3600).toFixed(1)}h`;

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const getEntryLabel = (entry: TimeEntryType) => {
  if (entry.taskCode) return `${entry.taskCode} ${entry.taskTitle || ""}`.trim();
  if (entry.projectName) return entry.projectName;
  return "Workspace time";
};

type TimerConflictError = Error & {
  response?: {
    status?: number;
    data?: StartTimerResponseType;
  };
};

const MetricCard = ({
  title,
  value,
  detail,
}: {
  title: string;
  value: string | number;
  detail?: string;
}) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-semibold">{value}</div>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </CardContent>
  </Card>
);

const EmptyState = ({ label }: { label: string }) => (
  <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
    {label}
  </div>
);

export default function ProductivityPage() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const { hasPermission, user } = useAuthContext();
  const [range, setRange] = useState<ProductivityRangeType>("7d");
  const [timerTaskId, setTimerTaskId] = useState("none");
  const [timerProjectId, setTimerProjectId] = useState("none");
  const [timerNote, setTimerNote] = useState("");
  const [manualTaskId, setManualTaskId] = useState("none");
  const [manualProjectId, setManualProjectId] = useState("none");
  const [manualStartedAt, setManualStartedAt] = useState(oneHourAgoInput());
  const [manualEndedAt, setManualEndedAt] = useState(nowInput());
  const [manualNote, setManualNote] = useState("");
  const [timesheetUserId, setTimesheetUserId] = useState("all");
  const [pendingStart, setPendingStart] =
    useState<StartTimerPayloadType["data"] | null>(null);
  const [conflictTimer, setConflictTimer] = useState<TimeEntryType | null>(null);

  const canViewTimesheets = hasPermission(Permissions.VIEW_TIMESHEETS);
  const canManageCapacity = hasPermission(Permissions.MANAGE_CAPACITY);

  const activeTimerQuery = useQuery({
    queryKey: ["time-active", workspaceId],
    queryFn: () => getActiveTimerQueryFn(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const entriesQuery = useQuery({
    queryKey: ["time-entries", workspaceId, user?._id],
    queryFn: () =>
      getTimeEntriesQueryFn({
        workspaceId,
        pageSize: 50,
      }),
    enabled: Boolean(workspaceId),
  });
  const timesheetQuery = useQuery({
    queryKey: ["timesheet", workspaceId, timesheetUserId],
    queryFn: () =>
      getTimesheetQueryFn({
        workspaceId,
        userId:
          canViewTimesheets && timesheetUserId !== "all"
            ? timesheetUserId
            : undefined,
      }),
    enabled: Boolean(workspaceId),
  });
  const workloadQuery = useQuery({
    queryKey: ["productivity-workload", workspaceId, range],
    queryFn: () => getProductivityWorkloadQueryFn({ workspaceId, range }),
    enabled: Boolean(workspaceId && canViewTimesheets),
  });
  const capacityQuery = useQuery({
    queryKey: ["productivity-capacity", workspaceId, range],
    queryFn: () => getProductivityCapacityQueryFn({ workspaceId, range }),
    enabled: Boolean(workspaceId && canViewTimesheets),
  });
  const tasksQuery = useQuery({
    queryKey: ["all-tasks", workspaceId, "productivity-picker"],
    queryFn: () => getAllTasksQueryFn({ workspaceId, pageSize: 100 }),
    enabled: Boolean(workspaceId),
  });
  const projectsQuery = useQuery({
    queryKey: ["allprojects", workspaceId, "productivity-picker"],
    queryFn: () => getProjectsInWorkspaceQueryFn({ workspaceId, pageSize: 100 }),
    enabled: Boolean(workspaceId),
  });
  const membersQuery = useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => getMembersInWorkspaceQueryFn(workspaceId),
    enabled: Boolean(workspaceId && canViewTimesheets),
  });

  const activeTimer = activeTimerQuery.data?.activeTimer;
  const tasks = useMemo(() => tasksQuery.data?.tasks || [], [tasksQuery.data]);
  const projects = useMemo(
    () => projectsQuery.data?.projects || [],
    [projectsQuery.data]
  );
  const members = useMemo(
    () => membersQuery.data?.members || [],
    [membersQuery.data]
  );

  const invalidateTime = () => {
    queryClient.invalidateQueries({ queryKey: ["time-active", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["time-entries", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["timesheet", workspaceId] });
    queryClient.invalidateQueries({
      queryKey: ["productivity-workload", workspaceId],
    });
    queryClient.invalidateQueries({
      queryKey: ["productivity-capacity", workspaceId],
    });
  };

  const startTimer = useMutation({
    mutationFn: startTimerMutationFn,
    onSuccess: () => {
      setTimerNote("");
      setTimerTaskId("none");
      setTimerProjectId("none");
      setPendingStart(null);
      setConflictTimer(null);
      invalidateTime();
      toast({ title: "Timer started", variant: "success" });
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
  const createEntry = useMutation({
    mutationFn: createTimeEntryMutationFn,
    onSuccess: () => {
      setManualNote("");
      setManualStartedAt(oneHourAgoInput());
      setManualEndedAt(nowInput());
      invalidateTime();
      toast({ title: "Time entry added", variant: "success" });
    },
    onError: (error: Error) =>
      toast({
        title: "Time entry failed",
        description: error.message,
        variant: "destructive",
      }),
  });
  const deleteEntry = useMutation({
    mutationFn: deleteTimeEntryMutationFn,
    onSuccess: invalidateTime,
  });
  const updateCapacity = useMutation({
    mutationFn: updateCapacityMutationFn,
    onSuccess: invalidateTime,
    onError: (error: Error) =>
      toast({
        title: "Capacity update failed",
        description: error.message,
        variant: "destructive",
      }),
  });

  const startPayload = () => ({
    taskId: timerTaskId !== "none" ? timerTaskId : undefined,
    projectId:
      timerTaskId === "none" && timerProjectId !== "none"
        ? timerProjectId
        : undefined,
    note: timerNote || undefined,
  });

  const handleStartTimer = () => {
    const data = startPayload();
    setPendingStart(data);
    startTimer.mutate({ workspaceId, data });
  };

  const handleStopExistingAndStart = () => {
    if (!pendingStart) return;
    stopTimer.mutate(workspaceId, {
      onSuccess: () => {
        startTimer.mutate({ workspaceId, data: pendingStart });
      },
    });
  };

  const selectedTaskProjectId = useMemo(() => {
    if (manualTaskId === "none") return null;
    return tasks.find((task) => task._id === manualTaskId)?.project?._id || null;
  }, [manualTaskId, tasks]);

  const totalOwnSeconds = (entriesQuery.data?.timeEntries || []).reduce(
    (sum, entry) => sum + entry.currentDurationSeconds,
    0
  );

  return (
    <main className="premium-page">
      <div className="premium-page-header">
        <div>
          <h2 className="premium-heading">Productivity</h2>
          <p className="premium-muted">
            Track time, review timesheets, and compare team capacity.
          </p>
        </div>
        <Select
          value={range}
          onValueChange={(value) => setRange(value as ProductivityRangeType)}
        >
          <SelectTrigger className="w-full md:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ranges.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="my-time" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="my-time">My Time</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
          <TabsTrigger value="workload" disabled={!canViewTimesheets}>
            Workload
          </TabsTrigger>
          <TabsTrigger value="capacity" disabled={!canViewTimesheets}>
            Capacity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-time" className="space-y-4 pt-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Timer className="h-4 w-4" />
                  Active Timer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeTimer ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                    <p className="text-sm font-medium text-emerald-800">
                      ▶ Running: {getEntryLabel(activeTimer)}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-900">
                      {formatSeconds(activeTimer.currentDurationSeconds)}
                    </p>
                    <Button
                      type="button"
                      className="mt-3 gap-2"
                      variant="destructive"
                      onClick={() => stopTimer.mutate(workspaceId)}
                      disabled={stopTimer.isPending}
                    >
                      <Square className="h-4 w-4" />
                      Stop Timer
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Task</Label>
                        <Select value={timerTaskId} onValueChange={setTimerTaskId}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No task</SelectItem>
                            {tasks.map((task) => (
                              <SelectItem key={task._id} value={task._id}>
                                {task.taskCode} {task.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Project</Label>
                        <Select
                          value={timerProjectId}
                          onValueChange={setTimerProjectId}
                          disabled={timerTaskId !== "none"}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No project</SelectItem>
                            {projects.map((project) => (
                              <SelectItem key={project._id} value={project._id}>
                                {project.emoji} {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Optional note"
                      value={timerNote}
                      onChange={(event) => setTimerNote(event.target.value)}
                    />
                    <Button
                      type="button"
                      className="gap-2"
                      onClick={handleStartTimer}
                      disabled={startTimer.isPending}
                    >
                      <Play className="h-4 w-4" />
                      Start Timer
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="h-4 w-4" />
                  Manual Entry
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Start</Label>
                    <Input
                      type="datetime-local"
                      value={manualStartedAt}
                      onChange={(event) => setManualStartedAt(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End</Label>
                    <Input
                      type="datetime-local"
                      value={manualEndedAt}
                      onChange={(event) => setManualEndedAt(event.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Task</Label>
                    <Select value={manualTaskId} onValueChange={setManualTaskId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No task</SelectItem>
                        {tasks.map((task) => (
                          <SelectItem key={task._id} value={task._id}>
                            {task.taskCode} {task.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Select
                      value={selectedTaskProjectId || manualProjectId}
                      onValueChange={setManualProjectId}
                      disabled={manualTaskId !== "none"}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project._id} value={project._id}>
                            {project.emoji} {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Textarea
                  placeholder="What did you work on?"
                  value={manualNote}
                  onChange={(event) => setManualNote(event.target.value)}
                />
                <Button
                  type="button"
                  onClick={() =>
                    createEntry.mutate({
                      workspaceId,
                      data: {
                        taskId: manualTaskId !== "none" ? manualTaskId : undefined,
                        projectId:
                          manualTaskId === "none" && manualProjectId !== "none"
                            ? manualProjectId
                            : undefined,
                        startedAt: new Date(manualStartedAt).toISOString(),
                        endedAt: new Date(manualEndedAt).toISOString(),
                        note: manualNote || undefined,
                      },
                    })
                  }
                  disabled={createEntry.isPending}
                >
                  Add Entry
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard title="Logged This Week" value={formatHours(totalOwnSeconds)} />
            <MetricCard
              title="Entries"
              value={entriesQuery.data?.timeEntries.length || 0}
            />
            <MetricCard
              title="Timer"
              value={activeTimer ? "Running" : "Stopped"}
              detail={activeTimer ? getEntryLabel(activeTimer) : "No active timer"}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Entries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {entriesQuery.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : entriesQuery.data?.timeEntries.length ? (
                entriesQuery.data.timeEntries.map((entry) => (
                  <div
                    key={entry._id}
                    className="premium-row-hover flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{getEntryLabel(entry)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(entry.startedAt)}
                        {entry.endedAt ? ` - ${formatDateTime(entry.endedAt)}` : ""}
                      </p>
                      {entry.note && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {entry.note}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {formatHours(entry.currentDurationSeconds)}
                      </Badge>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          deleteEntry.mutate({ workspaceId, entryId: entry._id })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState label="No time entries yet." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timesheets" className="space-y-4 pt-4">
          {canViewTimesheets && (
            <div className="max-w-xs">
              <Label>Member</Label>
              <Select value={timesheetUserId} onValueChange={setTimesheetUserId}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All members</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.userId._id} value={member.userId._id}>
                      {member.userId.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timesheet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Total: {formatHours(timesheetQuery.data?.timesheet.totalSeconds || 0)}
              </div>
              {timesheetQuery.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : timesheetQuery.data?.timesheet.days.length ? (
                timesheetQuery.data.timesheet.days.map((day) => (
                  <div key={day.date} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium">{day.date}</p>
                      <Badge variant="outline">{formatHours(day.totalSeconds)}</Badge>
                    </div>
                    <div className="space-y-2">
                      {day.entries.map((entry) => (
                        <div
                          key={entry._id}
                          className="flex justify-between gap-3 text-sm"
                        >
                          <span className="truncate">{getEntryLabel(entry)}</span>
                          <span className="shrink-0">
                            {formatHours(entry.currentDurationSeconds)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState label="No timesheet entries in this period." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workload" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Workload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {workloadQuery.data?.workload.members.map((member) => (
                <div
                  key={member.memberId}
                  className="premium-row-hover flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.openTasks} open tasks
                    </p>
                  </div>
                  <Badge variant="outline">
                    {formatHours(member.trackedSeconds)}
                  </Badge>
                </div>
              )) || <EmptyState label="Workload data is not available." />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capacity" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Capacity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {capacityQuery.data?.capacity.members.map((member) => (
                <div key={member.memberId} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatHours(member.trackedSeconds)} tracked of{" "}
                        {formatHours(member.capacitySeconds)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {member.utilizationPercent}%
                      </Badge>
                      {canManageCapacity && (
                        <Input
                          type="number"
                          min={0}
                          max={168}
                          defaultValue={member.capacityHoursPerWeek}
                          className="w-24"
                          onBlur={(event) =>
                            updateCapacity.mutate({
                              workspaceId,
                              memberId: member.memberId,
                              data: {
                                capacityHoursPerWeek: Number(event.target.value),
                              },
                            })
                          }
                        />
                      )}
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.min(member.utilizationPercent, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )) || <EmptyState label="Capacity data is not available." />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TimeConflictDialog
        open={Boolean(conflictTimer)}
        activeTimer={conflictTimer}
        isStopping={stopTimer.isPending}
        onStopExisting={handleStopExistingAndStart}
        onContinueExisting={() => {
          setConflictTimer(null);
          setPendingStart(null);
        }}
        onCancel={() => {
          setConflictTimer(null);
          setPendingStart(null);
        }}
      />
    </main>
  );
}
