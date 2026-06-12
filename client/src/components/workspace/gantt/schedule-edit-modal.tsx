import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

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
import { GanttTaskType } from "@/types/api.type";

const toDateInput = (value?: string | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

export default function ScheduleEditModal({
  open,
  onOpenChange,
  task,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: GanttTaskType | null;
  isSaving: boolean;
  onSave: (task: GanttTaskType, startDate: string | null, endDate: string | null) => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setStartDate(toDateInput(task?.startDate));
    setEndDate(toDateInput(task?.endDate));
  }, [open, task]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!task || !startDate || !endDate) return;
    onSave(task, startDate, endDate);
  };

  const clearSchedule = () => {
    if (!task) return;
    onSave(task, null, null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? `Schedule ${task.title}` : "Edit Schedule"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gantt-start-date">Start</Label>
              <Input
                id="gantt-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gantt-end-date">End</Label>
              <Input
                id="gantt-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={clearSchedule}
              disabled={!task || isSaving}
            >
              Clear
            </Button>
            <Button type="submit" disabled={!task || isSaving || !startDate || !endDate}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
