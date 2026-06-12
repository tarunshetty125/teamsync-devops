import { formatDistanceToNow } from "date-fns";
import { ActivityType } from "@/types/api.type";

const actorName = (actor: ActivityType["actor"]) =>
  typeof actor === "string" ? "Someone" : actor.name || actor.email || "Someone";

export default function ActivityFeed({
  activities,
  isLoading,
}: {
  activities: ActivityType[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading activity...</p>;
  }

  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div
          key={activity._id}
          className="flex items-start justify-between gap-3 border-b pb-3 last:border-0"
        >
          <div>
            <p className="text-sm font-medium">{activity.summary}</p>
            <p className="text-xs text-muted-foreground">
              {actorName(activity.actor)}
            </p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(activity.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
