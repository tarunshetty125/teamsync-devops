import { TimelineDependencyType } from "@/types/api.type";

type TaskPosition = {
  x: number;
  y: number;
};

export default function DependencyRenderer({
  dependencies,
  taskPositions,
}: {
  dependencies: TimelineDependencyType[];
  taskPositions: Record<string, TaskPosition>;
}) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {dependencies.map((dependency) => {
        const from = taskPositions[dependency.predecessorTask];
        const to = taskPositions[dependency.successorTask];

        if (!from || !to) return null;

        return (
          <line
            key={dependency._id}
            x1={`${from.x}%`}
            y1={from.y}
            x2={`${to.x}%`}
            y2={to.y}
            stroke="currentColor"
            strokeDasharray="4 4"
            strokeWidth="1.5"
            className="text-muted-foreground/60"
          />
        );
      })}
    </svg>
  );
}
