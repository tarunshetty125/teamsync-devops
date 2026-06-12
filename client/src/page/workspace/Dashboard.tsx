import { type ComponentType, useEffect, useMemo, useState } from "react";
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

const getHealthClass = (status: "HEALTHY" | "AT_RISK" | "CRITICAL") => {
  if (status === "HEALTHY") return "bg-emerald-100 text-emerald-700";
  if (status === "AT_RISK") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
};

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
  <Card className="shadow-none">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
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
    <div className="space-y-2 rounded-md border p-3 hover:bg-muted/30">
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
  <Card className="shadow-none">
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
                className="flex items-start justify-between gap-3 rounded-md border p-3 hover:bg-muted/30"
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
}) => (
  <div className="space-y-4">
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

const TeamDashboard = ({
  data,
  workspaceId,
}: {
  data: TeamDashboardResponseType["dashboard"];
  workspaceId: string;
}) => (
  <div className="space-y-4">
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
      <Card className="shadow-none">
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
      <Card className="shadow-none">
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
    <Card className="shadow-none">
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

const ExecutiveDashboard = ({
  data,
  workspaceId,
}: {
  data: ExecutiveDashboardResponseType["dashboard"];
  workspaceId: string;
}) => (
  <div className="space-y-4">
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
      <Card className="shadow-none">
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
                className="block rounded-md border p-3 hover:bg-muted/30"
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
      <Card className="shadow-none">
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
                  className="flex items-center justify-between rounded-md border p-3"
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
    <Card className="shadow-none">
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
    <main className="flex flex-1 flex-col py-4 md:pt-3">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
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
