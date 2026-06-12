import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Permissions } from "@/constant";
import { useAuthContext } from "@/context/auth-provider";
import { toast } from "@/hooks/use-toast";
import {
  createMilestoneMutationFn,
  deleteMilestoneMutationFn,
  updateMilestoneMutationFn,
} from "@/lib/api";
import {
  MilestoneStatusType,
  MilestoneType,
  TimelineProjectType,
} from "@/types/api.type";

const statuses: MilestoneStatusType[] = [
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
];

const toDateInput = (value?: string | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

export default function MilestoneModal({
  open,
  onOpenChange,
  workspaceId,
  projects,
  milestone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  projects: TimelineProjectType[];
  milestone?: MilestoneType | null;
}) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthContext();
  const canEdit = hasPermission(Permissions.EDIT_PROJECT);
  const canDelete = hasPermission(Permissions.MANAGE_WORKSPACE_SETTINGS);
  const firstProjectId = projects[0]?._id || "";
  const [project, setProject] = useState(firstProjectId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<MilestoneStatusType>("PLANNED");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["milestones", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["timeline", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["roadmap", workspaceId] });
  };

  const createMutation = useMutation({
    mutationFn: createMilestoneMutationFn,
    onSuccess: () => {
      invalidate();
      toast({ title: "Milestone created", variant: "success" });
      onOpenChange(false);
    },
  });
  const updateMutation = useMutation({
    mutationFn: updateMilestoneMutationFn,
    onSuccess: () => {
      invalidate();
      toast({ title: "Milestone updated", variant: "success" });
      onOpenChange(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteMilestoneMutationFn,
    onSuccess: () => {
      invalidate();
      toast({ title: "Milestone deleted", variant: "success" });
      onOpenChange(false);
    },
  });

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  useEffect(() => {
    if (!open) return;

    setProject(milestone?.project || firstProjectId);
    setName(milestone?.name || "");
    setDescription(milestone?.description || "");
    setStatus(milestone?.status || "PLANNED");
    setStartDate(toDateInput(milestone?.startDate));
    setDueDate(toDateInput(milestone?.dueDate));
  }, [firstProjectId, milestone, open]);

  const title = useMemo(
    () => (milestone ? "Edit Milestone" : "Create Milestone"),
    [milestone]
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (!canEdit || !project || !name.trim()) return;

    const data = {
      project,
      name: name.trim(),
      description: description.trim() || null,
      status,
      startDate: startDate || null,
      dueDate: dueDate || null,
    };

    if (milestone) {
      updateMutation.mutate({
        workspaceId,
        milestoneId: milestone._id,
        data,
      });
      return;
    }

    createMutation.mutate({ workspaceId, data });
  };

  const deleteMilestone = () => {
    if (!milestone || !canDelete) return;
    deleteMutation.mutate({ workspaceId, milestoneId: milestone._id });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="milestone-project">Project</Label>
            <Select value={project} onValueChange={setProject} disabled={!canEdit}>
              <SelectTrigger id="milestone-project">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((item) => (
                  <SelectItem key={item._id} value={item._id}>
                    {`${item.emoji || ""} ${item.name}`.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="milestone-name">Name</Label>
            <Input
              id="milestone-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canEdit}
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="milestone-description">Description</Label>
            <Textarea
              id="milestone-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={!canEdit}
              maxLength={2000}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as MilestoneStatusType)}
                disabled={!canEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-start-date">Start</Label>
              <Input
                id="milestone-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-due-date">Due</Label>
              <Input
                id="milestone-due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {milestone && canDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={deleteMilestone}
                disabled={isSaving}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </Button>
            )}
            <Button type="submit" disabled={!canEdit || isSaving || !project}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
