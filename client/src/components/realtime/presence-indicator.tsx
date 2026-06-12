import { cn } from "@/lib/utils";
import { useSocket } from "@/realtime/use-socket";

export default function PresenceIndicator({
  userId,
  showLabel = false,
  className,
}: {
  userId?: string | null;
  showLabel?: boolean;
  className?: string;
}) {
  const { isUserOnline } = useSocket();
  const online = isUserOnline(userId);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-2 w-2 rounded-full",
          online ? "bg-emerald-500" : "bg-muted-foreground/40"
        )}
      />
      {showLabel && <span>{online ? "Online" : "Offline"}</span>}
    </span>
  );
}
