import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Permissions } from "@/constant";
import { useAuthContext } from "@/context/auth-provider";
import useWorkspaceId from "@/hooks/use-workspace-id";
import { getActiveTimerQueryFn } from "@/lib/api";
import { TimeEntryType } from "@/types/api.type";

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
};

const getTimerLabel = (timer: TimeEntryType) => {
  if (timer.taskCode) return timer.taskCode;
  if (timer.projectName) return timer.projectName;
  return "Workspace time";
};

export default function ActiveTimerChip() {
  const workspaceId = useWorkspaceId();
  const { hasPermission } = useAuthContext();
  const canTrackTime = hasPermission(Permissions.TRACK_TIME);
  const [now, setNow] = useState(() => Date.now());

  const activeTimerQuery = useQuery({
    queryKey: ["time-active", workspaceId],
    queryFn: () => getActiveTimerQueryFn(workspaceId),
    enabled: Boolean(workspaceId && canTrackTime),
    refetchOnWindowFocus: true,
  });

  const activeTimer = activeTimerQuery.data?.activeTimer;

  useEffect(() => {
    if (!activeTimer) return;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeTimer]);

  const elapsedSeconds = useMemo(() => {
    if (!activeTimer) return 0;

    return Math.floor((now - new Date(activeTimer.startedAt).getTime()) / 1000);
  }, [activeTimer, now]);

  if (!activeTimer) return null;

  return (
    <Link
      to={`/workspace/${workspaceId}/productivity`}
      className="flex min-w-0 items-center gap-2 rounded-md border bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
    >
      <Clock className="h-3.5 w-3.5" />
      <span className="hidden max-w-40 truncate font-medium sm:inline">
        ▶ Running: {getTimerLabel(activeTimer)}
      </span>
      <span className="font-medium sm:hidden">▶</span>
      <Badge className="border-0 bg-emerald-100 text-emerald-800">
        {formatDuration(elapsedSeconds)}
      </Badge>
    </Link>
  );
}
