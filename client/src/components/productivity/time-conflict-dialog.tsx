import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TimeEntryType } from "@/types/api.type";

const getLabel = (timer: TimeEntryType | null) => {
  if (!timer) return "existing timer";
  if (timer.taskCode) return timer.taskCode;
  if (timer.projectName) return timer.projectName;
  return "workspace time";
};

export default function TimeConflictDialog({
  open,
  activeTimer,
  isStopping,
  onStopExisting,
  onContinueExisting,
  onCancel,
}: {
  open: boolean;
  activeTimer: TimeEntryType | null;
  isStopping: boolean;
  onStopExisting: () => void;
  onContinueExisting: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Timer already running</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You already have a timer running for {getLabel(activeTimer)}.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="destructive"
              onClick={onStopExisting}
              disabled={isStopping}
            >
              Stop Existing Timer
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onContinueExisting}
            >
              Continue Existing Timer
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
