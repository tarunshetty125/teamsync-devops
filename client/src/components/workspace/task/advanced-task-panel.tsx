import { ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Permissions, TaskPriorityEnum } from "@/constant";
import { useAuthContext } from "@/context/auth-provider";
import useWorkspaceId from "@/hooks/use-workspace-id";
import useGetWorkspaceMembers from "@/hooks/api/use-get-workspace-members";
import { toast } from "@/hooks/use-toast";
import PresenceIndicator from "@/components/realtime/presence-indicator";
import {
  addChecklistItemMutationFn,
  addTaskDependencyMutationFn,
  addTaskWatcherMutationFn,
  clearTaskRecurrenceMutationFn,
  createLabelMutationFn,
  createSubtaskMutationFn,
  deleteChecklistItemMutationFn,
  deleteLabelMutationFn,
  getAllTasksQueryFn,
  getLabelsQueryFn,
  getSubtasksQueryFn,
  getTaskByIdQueryFn,
  getTaskDependenciesQueryFn,
  getTaskWatchersQueryFn,
  removeTaskDependencyMutationFn,
  removeTaskWatcherMutationFn,
  replaceTaskLabelsMutationFn,
  unwatchTaskMutationFn,
  updateChecklistItemMutationFn,
  updateTaskRecurrenceMutationFn,
  watchTaskMutationFn,
} from "@/lib/api";
import { LabelType, TaskType } from "@/types/api.type";

const labelColors = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed"];

const Section = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className="space-y-3">
    <h3 className="text-sm font-semibold">{title}</h3>
    {children}
  </section>
);

export default function AdvancedTaskPanel({ task }: { task: TaskType }) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const { hasPermission, user } = useAuthContext();
  const projectId = task.project?._id || "";
  const taskQueryKey = ["task", workspaceId, task._id];
  const labelsQueryKey = ["labels", workspaceId];
  const subtasksQueryKey = ["subtasks", workspaceId, task._id];
  const dependenciesQueryKey = ["dependencies", workspaceId, task._id];
  const watchersQueryKey = ["watchers", workspaceId, task._id];
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [checklistText, setChecklistText] = useState("");
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState(labelColors[0]);
  const [dependencyTaskId, setDependencyTaskId] = useState("");
  const [watcherUserId, setWatcherUserId] = useState("");
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<
    "DAILY" | "WEEKLY" | "MONTHLY"
  >("WEEKLY");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceMax, setRecurrenceMax] = useState("");

  const canEditTask = hasPermission(Permissions.EDIT_TASK);
  const canCreateTask = hasPermission(Permissions.CREATE_TASK);
  const canManageRelations = hasPermission(Permissions.MANAGE_TASK_RELATIONS);
  const canManageLabels = hasPermission(Permissions.MANAGE_WORKSPACE_SETTINGS);

  const taskQuery = useQuery({
    queryKey: taskQueryKey,
    queryFn: () =>
      getTaskByIdQueryFn({
        workspaceId,
        projectId,
        taskId: task._id,
      }),
    enabled: Boolean(workspaceId && projectId && task._id),
  });
  const labelsQuery = useQuery({
    queryKey: labelsQueryKey,
    queryFn: () => getLabelsQueryFn({ workspaceId, pageSize: 100 }),
    enabled: Boolean(workspaceId),
  });
  const subtasksQuery = useQuery({
    queryKey: subtasksQueryKey,
    queryFn: () => getSubtasksQueryFn({ workspaceId, parentTaskId: task._id }),
    enabled: Boolean(workspaceId && task._id),
  });
  const dependenciesQuery = useQuery({
    queryKey: dependenciesQueryKey,
    queryFn: () =>
      getTaskDependenciesQueryFn({ workspaceId, taskId: task._id }),
    enabled: Boolean(workspaceId && task._id),
  });
  const watchersQuery = useQuery({
    queryKey: watchersQueryKey,
    queryFn: () => getTaskWatchersQueryFn({ workspaceId, taskId: task._id }),
    enabled: Boolean(workspaceId && task._id),
  });
  const allTasksQuery = useQuery({
    queryKey: ["all-tasks", workspaceId, "advanced-picker"],
    queryFn: () => getAllTasksQueryFn({ workspaceId, pageSize: 100 }),
    enabled: Boolean(workspaceId),
  });
  const membersQuery = useGetWorkspaceMembers(workspaceId);

  const currentTask = taskQuery.data?.task || task;
  const labels = labelsQuery.data?.labels || [];
  const activeLabelIds = new Set(currentTask.labels?.map((label) => label._id));
  const subtasks = subtasksQuery.data?.subtasks || [];
  const dependencies = dependenciesQuery.data?.dependencies || [];
  const dependencySummary = dependenciesQuery.data?.dependencySummary;
  const watchers = watchersQuery.data?.watchers || [];
  const members = membersQuery.data?.members || [];
  const otherTasks = useMemo(
    () =>
      (allTasksQuery.data?.tasks || []).filter(
        (candidate) => candidate._id !== task._id
      ),
    [allTasksQuery.data?.tasks, task._id]
  );
  const isWatching = watchers.some((watcher) => watcher.user._id === user?._id);

  const invalidateAdvanced = () => {
    queryClient.invalidateQueries({ queryKey: taskQueryKey });
    queryClient.invalidateQueries({ queryKey: labelsQueryKey });
    queryClient.invalidateQueries({ queryKey: subtasksQueryKey });
    queryClient.invalidateQueries({ queryKey: dependenciesQueryKey });
    queryClient.invalidateQueries({ queryKey: watchersQueryKey });
    queryClient.invalidateQueries({ queryKey: ["all-tasks", workspaceId] });
  };

  const mutationOptions = {
    onSuccess: invalidateAdvanced,
    onError: (error: Error) =>
      toast({
        title: "Task update failed",
        description: error.message,
        variant: "destructive",
      }),
  };

  const createSubtask = useMutation({
    mutationFn: createSubtaskMutationFn,
    ...mutationOptions,
    onSuccess: () => {
      setSubtaskTitle("");
      invalidateAdvanced();
    },
  });
  const addChecklist = useMutation({
    mutationFn: addChecklistItemMutationFn,
    ...mutationOptions,
    onSuccess: () => {
      setChecklistText("");
      invalidateAdvanced();
    },
  });
  const updateChecklist = useMutation({
    mutationFn: updateChecklistItemMutationFn,
    ...mutationOptions,
  });
  const deleteChecklist = useMutation({
    mutationFn: deleteChecklistItemMutationFn,
    ...mutationOptions,
  });
  const createLabel = useMutation({
    mutationFn: createLabelMutationFn,
    ...mutationOptions,
    onSuccess: () => {
      setLabelName("");
      invalidateAdvanced();
    },
  });
  const deleteLabel = useMutation({
    mutationFn: deleteLabelMutationFn,
    ...mutationOptions,
  });
  const replaceLabels = useMutation({
    mutationFn: replaceTaskLabelsMutationFn,
    ...mutationOptions,
  });
  const addDependency = useMutation({
    mutationFn: addTaskDependencyMutationFn,
    ...mutationOptions,
    onSuccess: () => {
      setDependencyTaskId("");
      invalidateAdvanced();
    },
  });
  const removeDependency = useMutation({
    mutationFn: removeTaskDependencyMutationFn,
    ...mutationOptions,
  });
  const addWatcher = useMutation({
    mutationFn: addTaskWatcherMutationFn,
    ...mutationOptions,
    onSuccess: () => {
      setWatcherUserId("");
      invalidateAdvanced();
    },
  });
  const removeWatcher = useMutation({
    mutationFn: removeTaskWatcherMutationFn,
    ...mutationOptions,
  });
  const watchTask = useMutation({
    mutationFn: watchTaskMutationFn,
    ...mutationOptions,
  });
  const unwatchTask = useMutation({
    mutationFn: unwatchTaskMutationFn,
    ...mutationOptions,
  });
  const updateRecurrence = useMutation({
    mutationFn: updateTaskRecurrenceMutationFn,
    ...mutationOptions,
  });
  const clearRecurrence = useMutation({
    mutationFn: clearTaskRecurrenceMutationFn,
    ...mutationOptions,
  });

  const toggleLabel = (label: LabelType) => {
    const nextIds = new Set(activeLabelIds);
    if (nextIds.has(label._id)) nextIds.delete(label._id);
    else nextIds.add(label._id);
    replaceLabels.mutate({
      workspaceId,
      taskId: task._id,
      labelIds: Array.from(nextIds),
    });
  };

  return (
    <div className="space-y-6">
      {taskQuery.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader className="h-4 w-4 animate-spin" />
          Loading task details...
        </div>
      )}

      <Section title="Subtasks">
        <div className="flex gap-2">
          <Input
            value={subtaskTitle}
            onChange={(event) => setSubtaskTitle(event.target.value)}
            placeholder="Add a subtask"
            disabled={!canCreateTask}
          />
          <Button
            type="button"
            size="icon"
            disabled={!canCreateTask || !subtaskTitle.trim()}
            onClick={() =>
              createSubtask.mutate({
                workspaceId,
                parentTaskId: task._id,
                data: {
                  title: subtaskTitle,
                  priority: currentTask.priority || TaskPriorityEnum.MEDIUM,
                  assignedTo: currentTask.assignedTo?._id || null,
                },
              })
            }
          >
            <Plus />
          </Button>
        </div>
        <div className="space-y-2">
          {subtasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subtasks.</p>
          ) : (
            subtasks.map((subtask) => (
              <div key={subtask._id} className="rounded-md border p-2 text-sm">
                <div className="font-medium">{subtask.title}</div>
                <div className="text-xs text-muted-foreground">
                  {subtask.status} · depth {subtask.subtaskDepth}
                </div>
              </div>
            ))
          )}
        </div>
      </Section>

      <Separator />

      <Section title="Checklist">
        <div className="flex gap-2">
          <Input
            value={checklistText}
            onChange={(event) => setChecklistText(event.target.value)}
            placeholder="Add a checklist item"
            disabled={!canEditTask}
          />
          <Button
            type="button"
            size="icon"
            disabled={!canEditTask || !checklistText.trim()}
            onClick={() =>
              addChecklist.mutate({
                workspaceId,
                taskId: task._id,
                text: checklistText,
              })
            }
          >
            <Plus />
          </Button>
        </div>
        <div className="space-y-2">
          {(currentTask.checklist || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No checklist items.</p>
          ) : (
            currentTask.checklist?.map((item) => (
              <div key={item._id} className="flex items-center gap-2">
                <Checkbox
                  checked={item.completed}
                  disabled={!canEditTask}
                  onCheckedChange={(checked) =>
                    updateChecklist.mutate({
                      workspaceId,
                      taskId: task._id,
                      itemId: item._id,
                      data: { completed: Boolean(checked) },
                    })
                  }
                />
                <span className="flex-1 text-sm">{item.text}</span>
                {canEditTask && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      deleteChecklist.mutate({
                        workspaceId,
                        taskId: task._id,
                        itemId: item._id,
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </Section>

      <Separator />

      <Section title="Labels">
        <div className="flex flex-wrap gap-2">
          {labels.map((label) => (
            <button
              key={label._id}
              type="button"
              disabled={!canEditTask}
              onClick={() => toggleLabel(label)}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
              style={{
                borderColor: label.color,
                backgroundColor: activeLabelIds.has(label._id)
                  ? `${label.color}22`
                  : undefined,
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              {label.name}
              {canManageLabels && (
                <span
                  role="button"
                  tabIndex={0}
                  className="ml-1 text-muted-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteLabel.mutate({ workspaceId, labelId: label._id });
                  }}
                >
                  ×
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={labelName}
            onChange={(event) => setLabelName(event.target.value)}
            placeholder="Create label"
            disabled={!canEditTask}
          />
          <Select value={labelColor} onValueChange={setLabelColor}>
            <SelectTrigger className="w-[120px]" disabled={!canEditTask}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {labelColors.map((color) => (
                <SelectItem key={color} value={color}>
                  {color}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon"
            disabled={!canEditTask || !labelName.trim()}
            onClick={() =>
              createLabel.mutate({
                workspaceId,
                data: { name: labelName, color: labelColor },
              })
            }
          >
            <Plus />
          </Button>
        </div>
      </Section>

      <Separator />

      <Section title="Dependencies">
        <div className="flex flex-wrap gap-2">
          {dependencySummary?.isBlocked && (
            <Badge variant="secondary">
              Blocked by {dependencySummary.incompleteBlockingCount}
            </Badge>
          )}
          <Badge variant="outline">
            Blocks {dependencySummary?.blockingCount || 0}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Select value={dependencyTaskId} onValueChange={setDependencyTaskId}>
            <SelectTrigger disabled={!canManageRelations}>
              <SelectValue placeholder="Depends on task" />
            </SelectTrigger>
            <SelectContent>
              {otherTasks.map((candidate) => (
                <SelectItem key={candidate._id} value={candidate._id}>
                  {candidate.taskCode} · {candidate.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon"
            disabled={!canManageRelations || !dependencyTaskId}
            onClick={() =>
              addDependency.mutate({
                workspaceId,
                taskId: task._id,
                predecessorTaskId: dependencyTaskId,
              })
            }
          >
            <Plus />
          </Button>
        </div>
        <div className="space-y-2">
          {dependencies.map((dependency) => (
            <div
              key={dependency._id}
              className="flex items-center justify-between rounded-md border p-2 text-sm"
            >
              <span>
                Depends on {dependency.predecessorTask.taskCode} ·{" "}
                {dependency.predecessorTask.title}
              </span>
              {canManageRelations && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    removeDependency.mutate({
                      workspaceId,
                      dependencyId: dependency._id,
                    })
                  }
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Separator />

      <Section title="Watchers">
        <div className="flex flex-wrap gap-2">
          {watchers.map((watcher) => (
            <Badge key={watcher._id} variant="secondary">
              {watcher.user.name || watcher.user.email}
              <PresenceIndicator userId={watcher.user._id} className="ml-2" />
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              isWatching
                ? unwatchTask.mutate({ workspaceId, taskId: task._id })
                : watchTask.mutate({ workspaceId, taskId: task._id })
            }
          >
            {isWatching ? "Unwatch" : "Watch"}
          </Button>
          <Select value={watcherUserId} onValueChange={setWatcherUserId}>
            <SelectTrigger disabled={!canManageRelations}>
              <SelectValue placeholder="Add watcher" />
            </SelectTrigger>
            <SelectContent>
              {members.map((member) => (
                <SelectItem key={member.userId._id} value={member.userId._id}>
                  <span className="inline-flex items-center gap-2">
                    <span>{member.userId.name || member.userId.email}</span>
                    <PresenceIndicator userId={member.userId._id} />
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon"
            disabled={!canManageRelations || !watcherUserId}
            onClick={() =>
              addWatcher.mutate({
                workspaceId,
                taskId: task._id,
                userId: watcherUserId,
              })
            }
          >
            <Plus />
          </Button>
        </div>
        {canManageRelations && (
          <div className="space-y-1">
            {watchers.map((watcher) => (
              <button
                type="button"
                key={`remove-${watcher._id}`}
                className="block text-xs text-muted-foreground"
                onClick={() =>
                  removeWatcher.mutate({
                    workspaceId,
                    taskId: task._id,
                    userId: watcher.user._id,
                  })
                }
              >
                Remove {watcher.user.name || watcher.user.email}
              </button>
            ))}
          </div>
        )}
      </Section>

      <Separator />

      <Section title="Recurrence">
        <div className="flex flex-wrap gap-2 text-sm">
          {currentTask.recurrence?.enabled ? (
            <Badge variant="secondary">
              {currentTask.recurrence.frequency} every{" "}
              {currentTask.recurrence.interval}
            </Badge>
          ) : (
            <span className="text-muted-foreground">Not recurring.</span>
          )}
          {currentTask.generatedFromTaskId && (
            <Badge variant="outline">Generated occurrence</Badge>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_100px_120px_auto_auto]">
          <Select
            value={recurrenceFrequency}
            onValueChange={(value) =>
              setRecurrenceFrequency(value as "DAILY" | "WEEKLY" | "MONTHLY")
            }
          >
            <SelectTrigger disabled={!canManageRelations}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Daily</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={1}
            value={recurrenceInterval}
            disabled={!canManageRelations}
            onChange={(event) =>
              setRecurrenceInterval(Number(event.target.value) || 1)
            }
          />
          <Input
            type="number"
            min={1}
            value={recurrenceMax}
            disabled={!canManageRelations}
            onChange={(event) => setRecurrenceMax(event.target.value)}
            placeholder="Max"
          />
          <Button
            type="button"
            disabled={!canManageRelations}
            onClick={() =>
              updateRecurrence.mutate({
                workspaceId,
                taskId: task._id,
                data: {
                  enabled: true,
                  frequency: recurrenceFrequency,
                  interval: recurrenceInterval,
                  maxOccurrences: recurrenceMax ? Number(recurrenceMax) : null,
                },
              })
            }
          >
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canManageRelations || !currentTask.recurrence?.enabled}
            onClick={() =>
              clearRecurrence.mutate({ workspaceId, taskId: task._id })
            }
          >
            Clear
          </Button>
        </div>
      </Section>
    </div>
  );
}
