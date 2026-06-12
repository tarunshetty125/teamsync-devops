type RouteMetric = {
  count: number;
  errors: number;
  totalDurationMs: number;
  maxDurationMs: number;
};

const startedAt = new Date();
const routes = new Map<string, RouteMetric>();

const routeKey = (method: string, path: string, statusCode: number) =>
  `${method.toUpperCase()} ${path} ${Math.floor(statusCode / 100)}xx`;

export const recordHttpMetric = ({
  method,
  path,
  statusCode,
  durationMs,
}: {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}) => {
  const key = routeKey(method, path, statusCode);
  const current =
    routes.get(key) ||
    ({
      count: 0,
      errors: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
    } satisfies RouteMetric);

  current.count += 1;
  current.totalDurationMs += durationMs;
  current.maxDurationMs = Math.max(current.maxDurationMs, durationMs);
  if (statusCode >= 500) current.errors += 1;
  routes.set(key, current);
};

export const getMetricsSnapshot = () => ({
  startedAt,
  uptimeSeconds: Math.round(process.uptime()),
  memory: process.memoryUsage(),
  routes: Array.from(routes.entries()).map(([key, metric]) => ({
    key,
    count: metric.count,
    errors: metric.errors,
    averageDurationMs:
      metric.count === 0
        ? 0
        : Math.round((metric.totalDurationMs / metric.count) * 100) / 100,
    maxDurationMs: Math.round(metric.maxDurationMs * 100) / 100,
  })),
});

const escapeLabelValue = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

export const getPrometheusMetrics = () => {
  const memory = process.memoryUsage();
  const lines = [
    "# HELP teamsync_process_uptime_seconds Process uptime in seconds.",
    "# TYPE teamsync_process_uptime_seconds gauge",
    `teamsync_process_uptime_seconds ${Math.round(process.uptime())}`,
    "# HELP teamsync_process_memory_bytes Process memory usage in bytes.",
    "# TYPE teamsync_process_memory_bytes gauge",
    `teamsync_process_memory_bytes{type="rss"} ${memory.rss}`,
    `teamsync_process_memory_bytes{type="heapTotal"} ${memory.heapTotal}`,
    `teamsync_process_memory_bytes{type="heapUsed"} ${memory.heapUsed}`,
    `teamsync_process_memory_bytes{type="external"} ${memory.external}`,
    "# HELP teamsync_http_requests_total HTTP requests handled by route and status class.",
    "# TYPE teamsync_http_requests_total counter",
    "# HELP teamsync_http_request_errors_total HTTP 5xx responses by route.",
    "# TYPE teamsync_http_request_errors_total counter",
    "# HELP teamsync_http_request_duration_ms_total Total HTTP request duration by route in milliseconds.",
    "# TYPE teamsync_http_request_duration_ms_total counter",
    "# HELP teamsync_http_request_duration_ms_max Maximum observed HTTP request duration by route in milliseconds.",
    "# TYPE teamsync_http_request_duration_ms_max gauge",
  ];

  for (const [key, metric] of routes.entries()) {
    const [method, path, statusClass] = key.split(" ");
    const labels = `method="${escapeLabelValue(method)}",path="${escapeLabelValue(
      path
    )}",status_class="${escapeLabelValue(statusClass)}"`;

    lines.push(`teamsync_http_requests_total{${labels}} ${metric.count}`);
    lines.push(`teamsync_http_request_errors_total{${labels}} ${metric.errors}`);
    lines.push(
      `teamsync_http_request_duration_ms_total{${labels}} ${Math.round(
        metric.totalDurationMs * 100
      ) / 100}`
    );
    lines.push(
      `teamsync_http_request_duration_ms_max{${labels}} ${
        Math.round(metric.maxDurationMs * 100) / 100
      }`
    );
  }

  return `${lines.join("\n")}\n`;
};
