import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  ListTodo,
  Loader2,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskStatusEnum } from "@/constant";
import { useAuthContext } from "@/context/auth-provider";
import useCreateProjectDialog from "@/hooks/use-create-project-dialog";
import useWorkspaceId from "@/hooks/use-workspace-id";
import {
  getExecutiveDashboardQueryFn,
  getPersonalDashboardQueryFn,
  getTeamDashboardQueryFn,
} from "@/lib/api";
import { transformStatusEnum } from "@/lib/helper";
import {
  DashboardRangeType,
  DashboardTaskItemType,
  ExecutiveDashboardResponseType,
  PersonalDashboardResponseType,
  TeamDashboardResponseType,
} from "@/types/api.type";

const ranges: { label: string; value: DashboardRangeType }[] = [
  { label: "7 days", value: "7d" },
  { label: "14 days", value: "14d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];

const formatDate = (value?: string | null) => {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
};

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const getHealthClass = (status: "HEALTHY" | "AT_RISK" | "CRITICAL") => {
  if (status === "HEALTHY") return "bg-emerald-100 text-emerald-700";
  if (status === "AT_RISK") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
};

const chartPalette = [
  "#111827",
  "#2563eb",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#64748b",
];

const statusChartColor = (status: string) => {
  if (status === TaskStatusEnum.DONE) return "#10b981";
  if (status === TaskStatusEnum.IN_REVIEW) return "#8b5cf6";
  if (status === TaskStatusEnum.IN_PROGRESS) return "#f59e0b";
  if (status === TaskStatusEnum.TODO) return "#2563eb";
  if (status === TaskStatusEnum.BACKLOG) return "#64748b";
  return "#111827";
};

type ChartDatum = {
  label: string;
  value: number;
  color?: string;
};

const getChartData = (data: ChartDatum[]) =>
  data.map((item, index) => ({
    ...item,
    value: Math.max(0, item.value || 0),
    color: item.color || chartPalette[index % chartPalette.length],
  }));

const hasChartData = (data: ChartDatum[]) =>
  data.some((item) => item.value > 0);

const ChartCard = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <Card className="overflow-hidden">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const PieChartCard = ({
  title,
  data,
}: {
  title: string;
  data: ChartDatum[];
}) => {
  const normalized = getChartData(data);
  const total = normalized.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const gradient = normalized
    .filter((item) => item.value > 0)
    .map((item) => {
      const start = cursor;
      const end = cursor + (item.value / total) * 100;
      cursor = end;
      return `${item.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <ChartCard title={title}>
      {total === 0 ? (
        <EmptyState label="No chart data yet." />
      ) : (
        <div className="flex items-center gap-4">
          <div
            className="grid h-28 w-28 shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(${gradient})` }}
            role="img"
            aria-label={`${title} pie chart`}
          >
            <div className="grid h-16 w-16 place-items-center rounded-full bg-background text-sm font-semibold">
              {formatCompactNumber(total)}
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            {normalized.slice(0, 4).map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="font-semibold">
                  {formatCompactNumber(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
};

const BarChartCard = ({
  title,
  data,
}: {
  title: string;
  data: ChartDatum[];
}) => {
  const normalized = getChartData(data).slice(0, 6);
  const max = Math.max(1, ...normalized.map((item) => item.value));

  return (
    <ChartCard title={title}>
      {!hasChartData(normalized) ? (
        <EmptyState label="No chart data yet." />
      ) : (
        <div className="flex h-36 items-end gap-2">
          {normalized.map((item) => (
            <div key={item.label} className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex h-24 items-end rounded-md bg-muted/50 px-1.5">
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: `${Math.max(8, (item.value / max) * 100)}%`,
                    backgroundColor: item.color,
                  }}
                  title={`${item.label}: ${item.value}`}
                />
              </div>
              <div className="text-center">
                <p className="truncate text-[11px] text-muted-foreground">
                  {item.label}
                </p>
                <p className="text-xs font-semibold">
                  {formatCompactNumber(item.value)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
};

const HistogramChartCard = ({
  title,
  data,
}: {
  title: string;
  data: ChartDatum[];
}) => {
  const normalized = getChartData(data).slice(0, 8);
  const max = Math.max(1, ...normalized.map((item) => item.value));

  return (
    <ChartCard title={title}>
      {!hasChartData(normalized) ? (
        <EmptyState label="No chart data yet." />
      ) : (
        <div className="space-y-3">
          <div className="flex h-28 items-end gap-1.5 rounded-md border bg-muted/20 p-3">
            {normalized.map((item) => (
              <div
                key={item.label}
                className="flex flex-1 items-end"
                title={`${item.label}: ${item.value}`}
              >
                <div
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${Math.max(10, (item.value / max) * 100)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="truncate">{normalized[0]?.label}</span>
            <span className="shrink-0">Distribution</span>
            <span className="truncate text-right">
              {normalized[normalized.length - 1]?.label}
            </span>
          </div>
        </div>
      )}
    </ChartCard>
  );
};

const LineChartCard = ({
  title,
  data,
}: {
  title: string;
  data: ChartDatum[];
}) => {
  const normalized = getChartData(data).slice(-12);
  const max = Math.max(1, ...normalized.map((item) => item.value));
  const width = 280;
  const height = 116;
  const points = normalized.map((item, index) => {
    const x =
      normalized.length === 1
        ? width / 2
        : 16 + (index / (normalized.length - 1)) * (width - 32);
    const y = height - 18 - (item.value / max) * (height - 38);
    return { ...item, x, y };
  });
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <ChartCard title={title}>
      {!hasChartData(normalized) ? (
        <EmptyState label="No chart data yet." />
      ) : (
        <div className="space-y-2">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-36 w-full"
            role="img"
            aria-label={`${title} line chart`}
          >
            <line
              x1="16"
              x2={width - 16}
              y1={height - 18}
              y2={height - 18}
              stroke="hsl(var(--border))"
            />
            <line
              x1="16"
              x2={width - 16}
              y1="18"
              y2="18"
              stroke="hsl(var(--border))"
              strokeDasharray="4 4"
            />
            <polyline
              fill="none"
              points={path}
              stroke="#2563eb"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
            {points.map((point) => (
              <circle
                key={`${point.label}-${point.x}`}
                cx={point.x}
                cy={point.y}
                fill="#ffffff"
                r="4"
                stroke="#2563eb"
                strokeWidth="2"
              />
            ))}
          </svg>
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="truncate">{normalized[0]?.label}</span>
            <span className="shrink-0">
              Peak {formatCompactNumber(max)}
            </span>
            <span className="truncate text-right">
              {normalized[normalized.length - 1]?.label}
            </span>
          </div>
        </div>
      )}
    </ChartCard>
  );
};

const DashboardCharts = ({
  pie,
  bar,
  histogram,
  line,
}: {
  pie: { title: string; data: ChartDatum[] };
  bar: { title: string; data: ChartDatum[] };
  histogram: { title: string; data: ChartDatum[] };
  line: { title: string; data: ChartDatum[] };
}) => (
  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
    <PieChartCard title={pie.title} data={pie.data} />
    <BarChartCard title={bar.title} data={bar.data} />
    <HistogramChartCard title={histogram.title} data={histogram.data} />
    <LineChartCard title={line.title} data={line.data} />
  </div>
);

const LoadingPanel = () => (
  <div className="flex min-h-[220px] items-center justify-center rounded-lg border bg-muted/20">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const ErrorPanel = () => (
  <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
    Dashboard data could not be loaded.
  </div>
);

const EmptyState = ({ label }: { label: string }) => (
  <div className="rounded-lg border bg-muted/20 p-5 text-center text-sm text-muted-foreground">
    {label}
  </div>
);

const MetricCard = ({
  title,
  value,
  icon: Icon,
  detail,
}: {
  title: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
  detail?: string;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </CardContent>
  </Card>
);

const ProgressRow = ({
  label,
  value,
  meta,
  href,
}: {
  label: string;
  value: number;
  meta?: string;
  href?: string;
}) => {
  const content = (
    <div className="premium-row-hover space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium">{label}</p>
        <span className="text-sm font-semibold">{Math.round(value)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${clampPercent(value)}%` }}
        />
      </div>
      {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
    </div>
  );

  return href ? <Link to={href}>{content}</Link> : content;
};

const TaskList = ({
  title,
  tasks,
  workspaceId,
}: {
  title: string;
  tasks: DashboardTaskItemType[];
  workspaceId: string;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {tasks.length === 0 ? (
        <EmptyState label="No tasks in this group." />
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const href = task.project?._id
              ? `/workspace/${workspaceId}/project/${task.project._id}?taskId=${task._id}`
              : `/workspace/${workspaceId}/tasks`;

            return (
              <Link
                key={task._id}
                to={href}
                className="premium-row-hover flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {task.taskCode}
                    {task.project?.name ? ` · ${task.project.name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge
                    variant={TaskStatusEnum[task.status]}
                    className="border-0 uppercase"
                  >
                    {transformStatusEnum(task.status)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(task.dueDate)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </CardContent>
  </Card>
);

const PersonalDashboard = ({
  data,
  workspaceId,
}: {
  data: PersonalDashboardResponseType["dashboard"];
  workspaceId: string;
}) => {
  const otherOpen = Math.max(
    0,
    data.summary.assignedOpenTasks -
      data.summary.dueToday -
      data.summary.overdue -
      data.summary.upcoming
  );
  const urgencyData = [
    { label: "Due today", value: data.summary.dueToday, color: "#2563eb" },
    { label: "Overdue", value: data.summary.overdue, color: "#ef4444" },
    { label: "Upcoming", value: data.summary.upcoming, color: "#10b981" },
    { label: "Other open", value: otherOpen, color: "#64748b" },
  ];
  const taskListData = [
    { label: "Today", value: data.dueTodayTasks.length, color: "#2563eb" },
    { label: "Overdue", value: data.overdueTasks.length, color: "#ef4444" },
    { label: "Upcoming", value: data.upcomingTasks.length, color: "#10b981" },
    {
      label: "Updated",
      value: data.recentlyUpdatedTasks.length,
      color: "#8b5cf6",
    },
  ];

  return (
    <div className="space-y-4">
      <DashboardCharts
        pie={{ title: "Pie: My Task Mix", data: urgencyData }}
        bar={{ title: "Bar: My Priorities", data: urgencyData }}
        histogram={{ title: "Histogram: Task Buckets", data: taskListData }}
        line={{ title: "Line: Focus Flow", data: taskListData }}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Assigned Open"
          value={data.summary.assignedOpenTasks}
          icon={ListTodo}
        />
        <MetricCard title="Due Today" value={data.summary.dueToday} icon={Clock} />
        <MetricCard
          title="Overdue"
          value={data.summary.overdue}
          icon={AlertTriangle}
        />
        <MetricCard title="Upcoming" value={data.summary.upcoming} icon={Activity} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <TaskList
          title="Due Today"
          tasks={data.dueTodayTasks}
          workspaceId={workspaceId}
        />
        <TaskList
          title="Overdue"
          tasks={data.overdueTasks}
          workspaceId={workspaceId}
        />
        <TaskList
          title="Upcoming"
          tasks={data.upcomingTasks}
          workspaceId={workspaceId}
        />
        <TaskList
          title="Recently Updated"
          tasks={data.recentlyUpdatedTasks}
          workspaceId={workspaceId}
        />
      </div>
    </div>
  );
};

const TeamDashboard = ({
  data,
  workspaceId,
}: {
  data: TeamDashboardResponseType["dashboard"];
  workspaceId: string;
}) => {
  const statusData = data.statusDistribution.map((item) => ({
    label: transformStatusEnum(item.status),
    value: item.count,
    color: statusChartColor(item.status),
  }));
  const workloadData = [...data.workload]
    .sort((left, right) => right.openTasks - left.openTasks)
    .slice(0, 6)
    .map((member, index) => ({
      label: member.name,
      value: member.openTasks,
      color: chartPalette[index % chartPalette.length],
    }));
  const projectOpenData = [...data.projectProgress]
    .sort((left, right) => right.openTasks - left.openTasks)
    .slice(0, 8)
    .map((project, index) => ({
      label: project.name,
      value: project.openTasks,
      color: chartPalette[index % chartPalette.length],
    }));
  const projectCompletionData = [...data.projectProgress]
    .sort((left, right) => left.completionRate - right.completionRate)
    .slice(-8)
    .map((project) => ({
      label: project.name,
      value: Math.round(project.completionRate),
      color: "#2563eb",
    }));

  return (
    <div className="space-y-4">
      <DashboardCharts
        pie={{ title: "Pie: Status Mix", data: statusData }}
        bar={{ title: "Bar: Team Workload", data: workloadData }}
        histogram={{ title: "Histogram: Project Load", data: projectOpenData }}
        line={{ title: "Line: Project Progress", data: projectCompletionData }}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Open Tasks" value={data.summary.openTasks} icon={ListTodo} />
        <MetricCard
          title="Unassigned Open"
          value={data.summary.unassignedOpenTasks}
          icon={AlertTriangle}
        />
        <MetricCard
          title="Completion Rate"
          value={`${Math.round(data.summary.completionRate)}%`}
          icon={CheckCircle2}
        />
        <MetricCard title="Total Tasks" value={data.summary.totalTasks} icon={BarChart3} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.workload.length === 0 ? (
              <EmptyState label="No members found." />
            ) : (
              data.workload.map((member) => (
                <ProgressRow
                  key={member.memberId}
                  label={member.name}
                  value={
                    data.summary.openTasks > 0
                      ? (member.openTasks / data.summary.openTasks) * 100
                      : 0
                  }
                  meta={`${member.openTasks} open task${
                    member.openTasks === 1 ? "" : "s"
                  } · ${member.role}`}
                />
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.statusDistribution.map((item) => (
              <ProgressRow
                key={item.status}
                label={transformStatusEnum(item.status)}
                value={
                  data.summary.totalTasks > 0
                    ? (item.count / data.summary.totalTasks) * 100
                    : 0
                }
                meta={`${item.count} task${item.count === 1 ? "" : "s"}`}
              />
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Progress</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 xl:grid-cols-2">
          {data.projectProgress.length === 0 ? (
            <EmptyState label="No projects found." />
          ) : (
            data.projectProgress.map((project) => (
              <ProgressRow
                key={project.projectId}
                href={`/workspace/${workspaceId}/project/${project.projectId}`}
                label={`${project.emoji || ""} ${project.name}`.trim()}
                value={project.completionRate}
                meta={`${project.completedTasks}/${project.totalTasks} complete · ${project.openTasks} open`}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ExecutiveDashboard = ({
  data,
  workspaceId,
}: {
  data: ExecutiveDashboardResponseType["dashboard"];
  workspaceId: string;
}) => {
  const completionMix = [
    {
      label: "Completed",
      value: data.summary.completedTasks,
      color: "#10b981",
    },
    { label: "Open", value: data.summary.openTasks, color: "#2563eb" },
    {
      label: "Overdue",
      value: data.summary.overdueOpenTasks,
      color: "#ef4444",
    },
    {
      label: "Blocked",
      value: data.summary.blockedOpenTasks,
      color: "#f59e0b",
    },
  ];
  const healthScores = [...data.projectHealth]
    .sort((left, right) => right.health.score - left.health.score)
    .slice(0, 6)
    .map((project) => ({
      label: project.name,
      value: Math.round(project.health.score),
      color:
        project.health.status === "HEALTHY"
          ? "#10b981"
          : project.health.status === "AT_RISK"
            ? "#f59e0b"
            : "#ef4444",
    }));
  const velocityBuckets = data.velocity.buckets.map((bucket) => ({
    label: formatDate(bucket.date),
    value: bucket.count,
    color: "#8b5cf6",
  }));
  const completionTrend = data.completionTrend.map((bucket) => ({
    label: formatDate(bucket.date),
    value: bucket.count,
    color: "#2563eb",
  }));

  return (
    <div className="space-y-4">
      <DashboardCharts
        pie={{ title: "Pie: Completion Mix", data: completionMix }}
        bar={{ title: "Bar: Project Health", data: healthScores }}
        histogram={{ title: "Histogram: Velocity", data: velocityBuckets }}
        line={{ title: "Line: Completion Trend", data: completionTrend }}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Projects"
          value={data.summary.totalProjects}
          icon={BarChart3}
        />
        <MetricCard title="Members" value={data.summary.totalMembers} icon={Users} />
        <MetricCard
          title="Completion Rate"
          value={`${Math.round(data.summary.completionRate)}%`}
          icon={CheckCircle2}
        />
        <MetricCard
          title="Velocity"
          value={data.velocity.completedInRange}
          icon={Activity}
          detail={`${data.velocity.averageCompletedPerDay} per day`}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.projectHealth.length === 0 ? (
              <EmptyState label="No projects found." />
            ) : (
              data.projectHealth.map((project) => (
                <Link
                  key={project.projectId}
                  to={`/workspace/${workspaceId}/project/${project.projectId}`}
                  className="premium-row-hover block rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">
                      {`${project.emoji || ""} ${project.name}`.trim()}
                    </p>
                    <Badge
                      variant="secondary"
                      className={getHealthClass(project.health.status)}
                    >
                      {project.health.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${clampPercent(project.health.score)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold">
                      {Math.round(project.health.score)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {project.overdueOpenTasks} overdue · {project.blockedOpenTasks} blocked
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Completion Trend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.completionTrend.every((bucket) => bucket.count === 0) ? (
              <EmptyState label="No completed tasks in this range." />
            ) : (
              data.completionTrend
                .filter((bucket) => bucket.count > 0)
                .map((bucket) => (
                  <div
                    key={bucket.date}
                    className="premium-row-hover flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="text-sm text-muted-foreground">
                      {formatDate(bucket.date)}
                    </span>
                    <span className="text-sm font-semibold">
                      {bucket.count} completed
                    </span>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Open Tasks"
          value={data.summary.openTasks}
          icon={ListTodo}
        />
        <MetricCard
          title="Overdue Open Rate"
          value={`${Math.round(data.productivity.overdueOpenRate)}%`}
          icon={AlertTriangle}
        />
        <MetricCard
          title="Blocked Open Rate"
          value={`${Math.round(data.productivity.blockedOpenRate)}%`}
          icon={ShieldCheck}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace Health</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Active Members"
            value={data.workspaceHealth.activeMembers}
            icon={Users}
            detail={`${data.workspaceHealth.inactiveMembers} inactive`}
          />
          <MetricCard
            title="Collaboration"
            value={data.workspaceHealth.collaboration.commentVolume}
            icon={Activity}
            detail={`${data.workspaceHealth.collaboration.fileUploads} uploads · ${data.workspaceHealth.collaboration.notificationVolume} notifications`}
          />
          <MetricCard
            title="Tracked Hours"
            value={data.workspaceHealth.productivity.trackedHours}
            icon={Clock}
            detail={`${data.workspaceHealth.productivity.activeTimers} active timers`}
          />
          <MetricCard
            title="Storage"
            value={formatBytes(data.workspaceHealth.storage.storageUsedBytes)}
            icon={BarChart3}
            detail={`${data.workspaceHealth.storage.fileCount} files`}
          />
        </CardContent>
      </Card>
    </div>
  );
};

const WorkspaceDashboard = () => {
  const { onOpen } = useCreateProjectDialog();
  const workspaceId = useWorkspaceId();
  const { user, workspace } = useAuthContext();
  const [range, setRange] = useState<DashboardRangeType>("30d");
  const [tab, setTab] = useState("personal");

  const currentRoleName = useMemo(
    () =>
      workspace?.members.find((member) => member.userId === user?._id)?.role
        .name || "MEMBER",
    [user?._id, workspace?.members]
  );
  const canViewExecutive =
    currentRoleName === "OWNER" || currentRoleName === "ADMIN";

  useEffect(() => {
    if (!canViewExecutive && tab === "executive") {
      setTab("personal");
    }
  }, [canViewExecutive, tab]);

  const personalQuery = useQuery({
    queryKey: ["dashboard", workspaceId, "personal", range],
    queryFn: () => getPersonalDashboardQueryFn({ workspaceId, range }),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const teamQuery = useQuery({
    queryKey: ["dashboard", workspaceId, "team", range],
    queryFn: () => getTeamDashboardQueryFn({ workspaceId, range }),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const executiveQuery = useQuery({
    queryKey: ["dashboard", workspaceId, "executive", range],
    queryFn: () => getExecutiveDashboardQueryFn({ workspaceId, range }),
    enabled: !!workspaceId && canViewExecutive,
    staleTime: 30_000,
  });

  return (
    <main className="premium-page flex flex-1 flex-col">
      <div className="premium-page-header">
        <div>
          <h2 className="premium-heading">Dashboard</h2>
          <p className="premium-muted">
            Workspace work, progress, and health at a glance.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={range}
            onValueChange={(value) => setRange(value as DashboardRangeType)}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ranges.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={onOpen}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          {canViewExecutive && (
            <TabsTrigger value="executive">Executive</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="personal">
          {personalQuery.isLoading ? <LoadingPanel /> : null}
          {personalQuery.isError ? <ErrorPanel /> : null}
          {personalQuery.data?.dashboard ? (
            <PersonalDashboard
              data={personalQuery.data.dashboard}
              workspaceId={workspaceId}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="team">
          {teamQuery.isLoading ? <LoadingPanel /> : null}
          {teamQuery.isError ? <ErrorPanel /> : null}
          {teamQuery.data?.dashboard ? (
            <TeamDashboard data={teamQuery.data.dashboard} workspaceId={workspaceId} />
          ) : null}
        </TabsContent>
        {canViewExecutive && (
          <TabsContent value="executive">
            {executiveQuery.isLoading ? <LoadingPanel /> : null}
            {executiveQuery.isError ? <ErrorPanel /> : null}
            {executiveQuery.data?.dashboard ? (
              <ExecutiveDashboard
                data={executiveQuery.data.dashboard}
                workspaceId={workspaceId}
              />
            ) : null}
          </TabsContent>
        )}
      </Tabs>
    </main>
  );
};

export default WorkspaceDashboard;
